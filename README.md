# Enterprise Retrieval-Augmented Generation (RAG) Platform

> A secure, multi-tenant knowledge platform that lets an organization upload its own documents and ask questions about them. Unauthorized document content never reaches the language model — the backend authorizes every retrieved candidate before it can influence an answer.

---

## What This Project Is

Most AI assistants answer from public internet data and cannot tell the difference between a public memo and a confidential contract.

This platform is built for the opposite case: a company that owns its knowledge and controls who sees it.

An organization uploads its documents — reports, contracts, HR policies, technical docs, research papers. The platform extracts the text, splits it into chunks, converts those chunks into vectors, and stores them. When a user asks a question, the AI service retrieves organization-scoped candidates; the backend checks the user's document-level access and current document versions before any candidate text can reach the language model. The answer is grounded in that authorized context, with citations back to the source.

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
  → remaining candidates are ordered by retrieval score
  → evidence sufficiency is checked
  → the model answers using only authorized context, with
     citations back to the source
  → the answer is validated and the query/answer pair is recorded
~~~

Two design decisions are worth calling out because they are the reason the project exists:

**Access is separate from hierarchy.** Being an admin, a manager, or a senior member does not grant access to a document. Document access is its own policy system, with allow and deny rules, unit scope, temporary grants, and an append-only audit trail. Explicit deny always wins, and no matching policy means no access.

**Documents are versioned, never overwritten.** When a document changes, a new immutable version is created, re-indexed, and becomes current. Older versions stay in the vector store, and cached retrieval results are validated against the current version before reuse, so a stale answer cannot be served from an old copy of a file.

---

## Query Pipeline & Security Contract

Every query request passes through a fixed pipeline. The backend is the sole authority for authorization; the AI service and Supabase pgvector are retrieval infrastructure only. The contract is enforced in code at `backend/src/services/query/query.service.js` and `backend/src/services/document/documentAccess.service.js`.

### Critical RAG security invariant

**UNAUTHORIZED CONTENT MUST NEVER REACH THE LLM.** Retrieved chunks are candidates, not authorized evidence. Before any candidate's text can reach a model, the backend must:

1. **Validate document identity.** The candidate's `document_id` and `version_id` must be traceable to a PostgreSQL `Document` and `DocumentVersion` row. Candidates with missing, malformed, or unverifiable metadata are dropped.
2. **Verify version freshness.** The candidate's `version_id` must equal the document's current `Document.currentVersionId`. A matching `document_id` alone does not establish authorization or version freshness.
3. **Authorize the requesting user.** `authorizeQueryDocuments` evaluates `DocumentAccessPolicy` rows for the `QUERY` action with deny-overrides-allow and deny-by-default semantics. The AI service's `organization_id` filter and pgvector retrieval scores cannot grant access.
4. **Reject unauthorized, invalid, mismatched, or unverifiable candidates.** Candidates that fail any check are removed before their text is consumed by any downstream component.
5. **Never pass unauthorized chunk text to the LLM.** Candidate ordering uses retrieval scores only; there is no model-based reranker. The LLM is invoked only after authorization and evidence sufficiency are confirmed.
6. **Build the final prompt exclusively from authorized evidence.** `buildSafeContext` sanitizes each chunk's text and attaches traceable source metadata. The system prompt instructs the model to treat all retrieved content as untrusted data and to refuse prompt-injection attempts.
7. **Use the safe fallback when evidence is insufficient.** If no authorized, usable evidence remains, the pipeline returns the fallback answer without calling the LLM.

A matching document ID alone does not establish authorization. Vector results, retrieval scores, cached content, and AI-service responses cannot grant access.

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
5. **Retrieve candidates** — on a cache miss, `queryAI.service.js` POSTs to the AI service `/api/v1/retrieve` endpoint. The AI service searches Supabase pgvector filtered by `organization_id` only, returning up to `min(top_k * 5, 200)` candidates.
6. **Authorize each candidate** — `authorizeQueryDocuments` evaluates `DocumentAccessPolicy` rows for the `QUERY` action with deny-overrides-allow and deny-by-default semantics. Candidates whose document the user cannot `QUERY`, or whose `version_id` does not match the document's current version, are discarded before score ordering and before their text reaches the LLM.
7. **Order, check evidence, and generate** — authorized candidates are sorted by retrieval score and limited to `topK`; evidence sufficiency is checked; the prompt is built exclusively from authorized, sanitized context; the LLM is invoked only when evidence is sufficient.
8. **Validate the answer & save history** — answer validation and the output guard run; PostgreSQL stores the query/answer history pair. The API response's `data` contains `{query, answer, sources, evidence, usedLLM, outputGuardPassed}`.

**Authorization-aware caching.** When the authorized-cache path yields a hit, the stored candidates are re-validated against the current `Document.currentVersionId` before reuse — stale versions are excluded. When any access policy is granted, updated, or revoked, `invalidateOrganizationAuthorizedQueryCache` deletes the entire authorized-retrieval namespace for the organization. The access-scope fingerprint (a SHA-256 over all matching `QUERY` policies, the user's unit hierarchy, role, and unit) is used as the authorized-cache key component so that a cache hit is only served under the same fingerprint. **Verified with stubs:** the fingerprint is recomputed per request and the authorized cache is invalidated on every policy mutation. **Not yet verified against live infrastructure:** that expiry, revocation, and invalidation behavior keep the cache authorization-safe under concurrent policy changes — a concurrent revocation could still race with a query, and time-dependent policy expiry has not been tested. Live-verification status remains pending.

**Never trusted:** pgvector retrieval scores, AI-service payload metadata, and model outputs. These can never grant or expand access.

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
| Caching and rate limiting | Redis | Raw and authorization-aware retrieval caches, rate limits, and BullMQ queue |
| AI service | FastAPI (Python) | Content processing and vector indexing |
| Extraction | PyMuPDF, python-docx, camelot, pdfplumber, Docling | PDF, DOCX, and TXT extraction with a Docling fallback |
| Chunking | Custom service | Page-aware, character-based chunks with overlap |
| Embeddings | Sentence Transformers (`all-MiniLM-L6-v2`) | Normalized vectors generated in batches |
| Vector database | Supabase PostgreSQL + pgvector | Organization-filtered similarity search |
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

## Getting Started

This is a multi-service project. For a complete local run, configure PostgreSQL
and the backend's required settings, provide S3 and Bedrock access for full
document/query workflows, and configure the AI service with Supabase pgvector. Redis is
optional; see the component guides for exact settings and Windows setup.

| Component | Guide |
| --- | --- |
| Backend API, database migrations, and backend tests | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) |
| AI service setup, pgvector configuration, and processing behavior | [`docs/ai-service.md`](docs/ai-service.md) |
| Frontend architecture and development workflow | [`docs/frontendDevelopment.md`](docs/frontendDevelopment.md) |
| Frontend implementation status and known limitations | [`docs/frontendDevelopmentLog.md`](docs/frontendDevelopmentLog.md) |

Start each service in its own terminal after completing its setup guide. The
frontend development server, Express API, and FastAPI service have separate
configuration and dependencies.

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
    │   └── query/    Retrieval, authorization-aware caching, score ordering, guardrails, LLM, history
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
    ├── vectorstore/  Supabase pgvector persistence and search
    └── retrieval/    Candidate retrieval
~~~

The AI service includes focused Python tests for chunking, PDF extraction, and processing. The backend has a Node.js test suite for authorization, document lifecycle and processing, query orchestration, metrics, and Redis toggling.

### `docs/` — Documentation

Each document has a deliberately narrow scope, and progress details are not duplicated between them.

~~~text
docs/
├── DATABASE.md                 Prisma models, lifecycle, access authorization, migrations
├── DEVELOPMENT.md              Backend architecture, pipelines, setup, API, testing
├── ai-service.md               AI-service architecture, configuration, extraction and retrieval
├── frontendDevelopment.md      Frontend architecture, UI rules, development workflow
├── frontendDevelopmentLog.md  Frontend progress, functionality, and known issues
└── frontendChangelog.md        File-level frontend change history
~~~

---

## Current Status

The repository contains the end-to-end application flow: organization and access management, document versioning and processing, and permission-aware retrieval with grounded answers. The frontend includes document-management and query interfaces. This project overview describes implemented code, not a production-readiness claim; check the component guides for current setup and verification details.

| Area | Status |
| --- | --- |
| Organization, permissions, invitations | Implemented |
| Document lifecycle, versions, access policies | Implemented |
| Document processing and vector indexing | Implemented |
| Permission-aware retrieval and grounded answers | Implemented |
| Version-aware caching and invalidation | Implemented |
| API rate limiting | Implemented |
| React frontend: auth, organization, permissions | Implemented |
| React frontend: document management and query interface | Implemented in the frontend |
| Backend automated tests | Present; run with `npm test` from `backend/` |
| Frontend automated tests | No frontend test runner is currently configured |
| Live integration and production deployment | Not established by the local test suite |

The backend uses retrieval-score ordering rather than a learned semantic reranker. For current backend behavior and verification boundaries, see [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md); for frontend functionality and known limitations, see [`docs/frontendDevelopmentLog.md`](docs/frontendDevelopmentLog.md).

---

## Project Philosophy

The point of this project is not to demonstrate a chatbot. It is to build the surrounding system that makes an AI answer trustworthy inside an organization: who may read what, which version of a document is current, whether the retrieved evidence is actually sufficient, and whether the answer the model produced is supported by the sources it cites.

When the evidence is not sufficient, the platform says so instead of guessing.
