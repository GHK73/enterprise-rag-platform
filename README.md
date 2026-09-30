# Enterprise Retrieval-Augmented Generation (RAG) Platform

> A secure, multi-tenant knowledge platform that lets an organization upload its own documents and ask questions about them, without ever showing the AI anything the asker is not allowed to read.

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

**3. An AI service** that does the heavy content work: reading uploaded files, splitting them into chunks, embedding those chunks, storing and searching vectors. It is deliberately *not* trusted with access decisions — it filters by organization only, and the backend re-validates every candidate before generation.

The end-to-end flow:

~~~text
Create organization
  → structure departments, teams, groups
  → invite members and assign scoped permissions
  → upload documents and configure access
  → documents are extracted, chunked, embedded, indexed
  → user asks a question
  → authorized documents are resolved
  → only their chunks are retrieved and reranked
  → the model answers using that context, with citations
  → the answer is validated and recorded
~~~

Two design decisions are worth calling out because they are the reason the project exists:

**Access is separate from hierarchy.** Being an admin, a manager, or a senior member does not grant access to a document. Document access is its own policy system, with allow and deny rules, unit scope, temporary grants, and an append-only audit trail. Explicit deny always wins, and no matching policy means no access.

**Documents are versioned, never overwritten.** When a document changes, a new immutable version is created, re-indexed, and becomes current. Older versions stay in the vector store, and cached retrieval results are validated against the current version before reuse, so a stale answer cannot be served from an old copy of a file.

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

Backend work through reliability, caching, and the full query pipeline is implemented. The document management UI is in progress. Evaluation, monitoring, and deployment have not started.

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
| Evaluation and monitoring | Not started |
| Deployment and observability | Not started |

**A code audit on 2026-09-30 found a number of defects in these implemented areas**, including document access management failing on every call, a security system prompt that is never actually sent to the language model, and missing access checks on several document read paths. The code is a working skeleton of each feature rather than a verified one, and none of it should be run against real data yet. The findings are recorded in `docs/DEVELOPMENT.md`, `docs/ai-service.md`, `docs/frontendDevelopmentLog.md`, and `docs/DATABASE.md`.

Hybrid retrieval, semantic reranking, streaming answers, and a retrieval interface are intentionally left for later phases.

---

## Project Philosophy

The point of this project is not to demonstrate a chatbot. It is to build the surrounding system that makes an AI answer trustworthy inside an organization: who may read what, which version of a document is current, whether the retrieved evidence is actually sufficient, and whether the answer the model produced is supported by the sources it cites.

When the evidence is not sufficient, the platform says so instead of guessing.
