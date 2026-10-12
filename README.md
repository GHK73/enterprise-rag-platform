# Enterprise Retrieval-Augmented Generation (RAG) Platform

> A secure, multi-tenant knowledge platform that lets an organization upload its own documents and ask questions about them. Unauthorized document content never reaches the language model — the backend authorizes every retrieved candidate before it can influence an answer.

---

## What This Project Is

Most AI assistants answer from public internet data and cannot tell the difference between a public memo and a confidential contract.

This platform is built for the opposite case: a company that owns its knowledge and controls who sees it.

An organization uploads its documents — reports, contracts, HR policies, technical docs, research papers. The platform extracts the text, splits it into chunks, converts those chunks into vectors, and stores them. When a user asks a question, the platform searches only the documents that user is permitted to read, and the language model answers using only that retrieved content, with citations back to the source.

Everything else in the project exists to support that one rule:

~~~text
Unauthorized content must never reach the LLM.
~~~

This is not a chatbot wrapper. It is an attempt to combine three problems that are usually solved separately — organizational structure and permissions, document storage and lifecycle, and retrieval-augmented generation — into one system that treats access control as a first-class concern rather than a filter applied afterward.

---

## Who It Is For

* Organizations that need to query internal knowledge safely
* Teams evaluating how retrieval quality and hallucination rates behave in a real pipeline
* Engineers interested in permission-aware RAG, multi-tenancy, and version-aware caching

---

## How It Works

The platform has three cooperating parts.

**1. A web interface** where people manage the organization, its members, its permissions, its documents, and ask questions.

**2. A backend API** that is the only authority on who may access what. It decides, per request, whether a document is visible to the requesting user, and it is the only component allowed to send text to the language model.

**3. An AI service** that does the heavy content work: reading uploaded files, splitting them into chunks, embedding those chunks, storing and searching vectors. It is deliberately *not* trusted with access decisions — it filters by organization only and returns candidate chunks, some of which the user may not be permitted to read. The backend re-validates and authorizes every candidate before any of its text can reach the language model.

The end-to-end flow:

~~~text
Create organization
  → structure departments, teams, groups
  → invite members and assign scoped permissions
  → upload documents and configure access
  → documents are extracted, chunked, embedded, indexed
  → user asks a question
  → backend authenticates user and resolves organization
  → AI service retrieves candidate chunks for the whole org
     (candidates may include content the user cannot read)
  → backend validates each candidate's document identity and version
  → backend authorizes each candidate against DocumentAccessPolicy
     (deny-overrides-allow, deny-by-default)
  → backend discards every candidate whose document the user is
     not authorized to QUERY, or whose version is stale
  → remaining candidates are reranked by retrieval score
  → evidence sufficiency is checked
  → the model answers using only authorized context, with
     citations back to the source
  → the answer is validated against injection and citation
     rules, then recorded
~~~

Two design decisions are worth calling out because they are the reason the project exists:

**Access is separate from hierarchy.** Being an admin, a manager, or a senior member does not grant access to a document. Document access is its own policy system, with allow and deny rules, unit scope, temporary grants, and an append-only audit trail. Explicit deny always wins, and no matching policy means no access.

**Documents are versioned, never overwritten.** When a document changes, a new immutable version is created, re-indexed, and becomes current. Older versions stay in the vector store, and cached retrieval results are validated against the current version before reuse, so a stale answer cannot be served from an old copy of a file.

---

## Query Pipeline & Security Contract

Every query request passes through a fixed pipeline. The backend is the sole authority for authorization; the AI service and Qdrant are retrieval infrastructure only. The contract is enforced in code at `backend/src/services/query/query.service.js` and `backend/src/services/document/documentAccess.service.js`.

### Critical RAG security invariant

**UNAUTHORIZED CONTENT MUST NEVER REACH THE LLM.** Retrieved chunks are candidates, not authorized evidence. Before any candidate's text can reach a model, the backend must:

1. **Validate document identity.** The candidate's `document_id` and `version_id` must be traceable to a PostgreSQL `Document` and `DocumentVersion` row. Candidates with missing, malformed, or unverifiable metadata are dropped.
2. **Verify version freshness.** The candidate's `version_id` must equal the document's current `Document.currentVersionId`. A matching `document_id` alone does not establish authorization or version freshness.
3. **Authorize the requesting user.** `authorizeQueryDocuments` evaluates `DocumentAccessPolicy` rows for the `QUERY` action with deny-overrides-allow and deny-by-default semantics. The AI service's `organization_id` filter and Qdrant retrieval scores cannot grant access.
4. **Reject unauthorized, invalid, mismatched, or unverifiable candidates.** Candidates that fail any check are removed before their text is consumed by any downstream component.
5. **Never pass unauthorized chunk text to a model-based reranker or the final LLM.** Reranking is score-based only; no document text is sent to any model during this step. The LLM is invoked only after authorization and evidence sufficiency are confirmed.
6. **Build the final prompt exclusively from authorized evidence.** `buildSafeContext` sanitizes each chunk's text and attaches traceable source metadata. The system prompt instructs the model to treat all retrieved content as untrusted data and to refuse prompt-injection attempts.
7. **Use the safe fallback when evidence is insufficient.** If no authorized, usable evidence remains, the pipeline returns the fallback answer without calling the LLM.

A matching document ID alone does not establish authorization. Qdrant results, retrieval scores, cached content, and AI-service responses cannot grant access.

### Authoritative policy evaluator

The single, shared authorization engine lives in `backend/src/services/document/documentAccess.service.js`. It is the only place where `DocumentAccessPolicy` rows are resolved against a user. Every authorization path — single-document actions, batched listings, query retrieval, and the access-scope fingerprint — resolves through the exported helpers below. No other module contains policy-matching logic.

| Function | Role |
| --- | --- |
| `policyMatchesUser(policy, user, userUnitHierarchy)` | Shared subject matcher. Returns `true` only when the policy is active and its subject matches the user. Unknown `subjectType` values return `false` — they never grant access. |
| `evaluatePolicyMatches(policies, user, userUnitHierarchy)` | Filters a policy list to the active policies that match the user. Inactive, revoked, expired, and not-yet-valid policies are skipped before matching. |
| `resolvePolicyDecision(matches)` | Converts a match set into `allowed` or `denied`. Any matching `DENY` → `denied`; otherwise a matching `ALLOW` → `allowed`; an empty match set → `denied`. |
| `authorizeDocumentAction(user, documentId, action)` | Single-document authorization for `VIEW`, `DOWNLOAD`, and `MANAGE_ACCESS` checks on document read paths. |
| `authorizeDocumentsForAction(user, documentIds, action)` | Batched authorization for listing endpoints. Two queries total; returns a `Map` of `documentId → boolean`. |
| `authorizeQueryDocuments(user, documentIds)` | Query-retrieval authorization. Returns `[{documentId, currentVersionId}]` pairs for documents the user may query. |
| `getQueryAccessScopeFingerprint(user)` | SHA-256 over the user's organization, unit, role, unit hierarchy, and matched `QUERY` policies. Used as the authorized-cache key component. |

**Authorization rules enforced by the evaluator:**

- DENY overrides ALLOW. No matching applicable ALLOW means denied.
- Inactive, revoked, expired, and not-yet-valid policies must not grant access.
- Organization boundaries and supported user, role, and organizational-unit scopes must be enforced.
- Unknown policy subject types must not accidentally grant access.
- Single-document and batch authorization must apply consistent decision semantics.

### Execution flow

Every query request passes through a fixed pipeline (full detail in `docs/DEVELOPMENT.md`):

1. **Authenticate** — the `authenticate` middleware verifies the JWT, loads the user from PostgreSQL (including the `unit` relation), and rejects inactive accounts (401/403).
2. **Resolve identity** — the user's `unit.organizationId` and `unitId` are extracted; a user without an organization unit is rejected (403).
3. **Validate query & rate limit** — `query.controller.js` rejects empty or whitespace-only queries and `topK` values outside 1–20 (400). A per-user Redis token-bucket rate limiter caps query throughput; on a Redis outage the limit fails open (allow) or closed (503) per `RATE_LIMIT_UNAVAILABLE_POLICY`.
4. **Check the raw retrieval cache** — the query cache (`rag:retrieval:{orgId}:{topK}:{queryHash}`, 300 s TTL) stores the AI service's raw candidate list keyed by organization plus query, **not** by user or access scope. A cache hit is candidate evidence, not authorized content.
5. **Retrieve candidates** — on a cache miss, `queryAI.service.js` POSTs to the AI service `/api/v1/retrieve` endpoint. The AI service searches Qdrant filtered by `organization_id` only, returning up to `min(top_k * 5, 200)` candidates.
6. **Authorize each candidate** — `authorizeQueryDocuments` evaluates `DocumentAccessPolicy` rows for the `QUERY` action with deny-overrides-allow and deny-by-default semantics. Candidates whose document the user cannot `QUERY`, or whose `version_id` does not match the document's current version, are discarded **before** their text reaches the reranker or the LLM.
7. **Rerank, check evidence, and generate** — authorized candidates are reranked by descending retrieval score (score-based, not model-based); evidence sufficiency is checked; the prompt is built exclusively from authorized, sanitized context; the LLM is invoked only when evidence is sufficient.
8. **Validate the answer & save history** — citation validation and the output guardrail run; the query, answer, sources, evidence, `usedLLM`, and `outputGuardPassed` are persisted to PostgreSQL. The HTTP response is exactly `{query, answer, sources, evidence, usedLLM, outputGuardPassed}`.

**Authorization-aware caching.** When the authorized-cache path yields a hit, the stored candidates are re-validated against the current `Document.currentVersionId` before reuse — stale versions are excluded. When any access policy is granted, updated, or revoked, `invalidateOrganizationAuthorizedQueryCache` deletes the entire authorized-retrieval namespace for the organization. The access-scope fingerprint (a SHA-256 over all matching `QUERY` policies, the user's unit hierarchy, role, and unit) is used as the authorized-cache key component so that a cache hit is only served under the same fingerprint. **Verified with stubs:** the fingerprint is recomputed per request and the authorized cache is invalidated on every policy mutation. **Not yet verified against live infrastructure:** that expiry, revocation, and invalidation behavior keep the cache authorization-safe under concurrent policy changes — a concurrent revocation could still race with a query, and time-dependent policy expiry has not been tested. Live-verification status remains pending.

**Never trusted:** Qdrant retrieval scores, AI-service payload metadata, and model outputs. These can never grant or expand access.

---

## Technology Used

| Layer | Technology | Why |
| --- | --- | --- |
| Frontend | React + Vite | Component-based UI with fast local development |
| Frontend routing | React Router DOM | Public and protected route branches |
| Frontend HTTP | Axios | Single shared instance with a JWT request interceptor |
| Frontend state | React Context API | One authentication context, page-local state elsewhere |
| Frontend styling | Component-scoped CSS | Global design tokens, per-component style files |
| Backend API | Node.js + Express.js | REST API with versioned routes and layered services |
| ORM | Prisma | Typed database access and migrations |
| Database | PostgreSQL | Source of truth for application state and authorization |
| File storage | Amazon S3 | Private bucket, checksummed uploads, presigned downloads |
| Background jobs | Redis + BullMQ | Asynchronous document processing with retries |
| Caching | Redis | Tenant-scoped retrieval cache and API rate limiting |
| AI service | FastAPI (Python) | Content processing and vector indexing |
| Extraction | PyMuPDF, python-docx, camelot, pdfplumber, Docling | PDF, DOCX, and TXT extraction with a Docling fallback |
| Chunking | Custom service | Page-aware, character-based chunks with overlap |
| Embeddings | Sentence Transformers (`all-MiniLM-L6-v2`) | Local, fast, 384-dimensional vectors |
| Vector database | Qdrant | Filtered similarity search with payload indexes |
| LLM | Amazon Bedrock Converse API (`amazon.nova-pro-v1:0`) | Grounded answer generation from retrieved context |

---

## Project Structure

~~~text
RAG/
├── frontend/     React user interface
├── backend/      Express API, authorization, orchestration
├── ai-service/   FastAPI document processing and vector search
├── docs/         Architecture and development documentation
├── evaluation/   Reserved for retrieval and generation quality evaluation
└── README.md     This file
~~~

### `frontend/` — React user interface

The authenticated and public experience of the platform.

~~~text
frontend/src/
├── api/          Axios instance and document endpoint wrappers
├── components/   Shared components: Navbar, ProtectedRoute, PublicRoute
├── context/      AuthContext — the only global state container
├── layouts/      PublicLayout, shared by public and protected routes
├── pages/        One folder per screen
├── routes/       Document route fragments
├── App.jsx       Public and protected route branches
└── index.css     Reset, fonts, CSS variables, global typography
~~~

Pages include Home, Login, Register, Dashboard, Create Organization, Organization, Permissions, Invitations, and the Documents suite (library, draft creation, upload, and details).

### `backend/` — Express API and authorization authority

The security boundary of the whole system. Nothing reaches the language model without passing through this layer.

~~~text
backend/
├── prisma/           Schema and migrations
├── server.js         Entry point
└── src/
    ├── config/       Environment, Prisma, S3, AI, Redis, BullMQ, rate limits
    ├── controllers/  Request handlers
    ├── middleware/   Authentication, uploads, rate limiting, error handling
    ├── routes/       Route definitions mounted under /api/v1
    ├── services/     Business logic
    │   ├── document/ Lifecycle, S3 storage, access policies, processing dispatch
    │   └── query/    Retrieval, caching, reranking, guardrails, LLM, history
    ├── workers/      BullMQ document processing worker
    └── utils/        Errors, responses, JWT, password, validation helpers
~~~

### `ai-service/` — Document processing and vector search

Converts files into searchable knowledge. It is not allowed to make access decisions.

~~~text
ai-service/app/
├── api/          FastAPI routes: health, process-document, retrieve
├── config/       Settings, chunking config, logging
├── core/         Exception types and global handlers
├── schemas/      Request and response models
└── services/
    ├── processing/   Download, extract, normalize, chunk pipeline
    ├── extractors/   Per-format extractors plus Docling fallback
    ├── embedding/    Sentence Transformer embeddings
    ├── vectorstore/  Qdrant collection management and search
    └── retrieval/    Candidate retrieval
~~~

Root-level test scripts (`test_chunking.py`, `test_processing.py`, and others) exercise each stage of the pipeline against a sample document.

### `docs/` — Documentation

Each document has a deliberately narrow scope, and progress details are not duplicated between them.

~~~text
docs/
├── DATABASE.md                 Prisma models, lifecycle, access authorization, migrations
├── DEVELOPMENT.md              Backend development log, API surface, setup, phases
├── ai-service.md               AI-service architecture, configuration, gaps
├── frontendDevelopment.md      Frontend architecture, UI rules, development workflow
└── frontendDevelopmentLog.md  Frontend progress and known issues
~~~

---

## Current Status

Backend work through reliability, caching, and the full query pipeline is implemented. The document management UI is in progress. Evaluation is in progress; monitoring and deployment have not started.

| Area | Status |
| --- | --- |
| Organization, permissions, invitations | Implemented |
| Document lifecycle, versions, access policies | Implemented |
| Document processing and vector indexing | Implemented |
| Permission-aware retrieval and grounded answers | Implemented |
| Version-aware caching and invalidation | Implemented |
| API rate limiting | Implemented |
| React frontend: auth, organization, permissions | Implemented |
| React frontend: document management | In progress |
| Evaluation | In progress |
| Monitoring and observability | Not started |
| Deployment | Not started |

**A code audit on 2026-09-30 found a number of defects in these implemented areas**, including document access management failing on every call, a security system prompt that is never actually sent to the language model, missing access checks on several document read paths, and three Redis-backed features (both query caches and login rate limiting) that cannot reach Redis because they are handed a connection configuration object instead of a client. All of those findings are resolved and regression-tested with stubs as of 2026-10-12 — see `docs/DEVELOPMENT.md` (What we did, Verification Levels). The fixes are recorded in `docs/DEVELOPMENT.md`, `docs/ai-service.md`, `docs/frontendDevelopmentLog.md`, and `docs/DATABASE.md`. **Scope note:** the audit fixes were verified with injected stubs for Redis, Prisma, S3, and the AI service. The live system — real Redis, AI service, Qdrant, database, and LLM provider — has not yet been verified end-to-end. Deployment, live-infrastructure verification, and evaluation remain unfinished.

Hybrid retrieval, semantic reranking, streaming answers, and a retrieval interface are intentionally left for later phases.

---

## Project Philosophy

The point of this project is not to demonstrate a chatbot. It is to build the surrounding system that makes an AI answer trustworthy inside an organization: who may read what, which version of a document is current, whether the retrieved evidence is actually sufficient, and whether the answer the model produced is supported by the sources it cites.

When the evidence is not sufficient, the platform says so instead of guessing.
