# Enterprise RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend.

Database design: [`docs/DATABASE.md`](DATABASE.md)

---

# Current Status

**Active Phase:** Phase 6 — Document Processing

| Area | Status |
| --- | --- |
| Backend Foundation | ✅ |
| Authentication & Identity | ✅ |
| Organization Management | ✅ |
| Access & Administration | ✅ |
| Organization Synchronization | ✅ |
| Concurrency Protection | ✅ |
| Document Management | ✅ |
| Document Processing Infrastructure | ✅ |
| AI Processing Service | ✅ |

---

# Local Setup

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

**Environment variables** (`backend/.env`):

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port |
| `NODE_ENV` | Application environment |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry |
| `AWS_REGION` | Amazon S3 region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_S3_BUCKET` | Document storage bucket |
| `REDIS_ENABLED` | Enable or disable Redis queue |
| `REDIS_URL` | Managed Redis connection |
| `AI_SERVICE_URL` | FastAPI AI service endpoint |
| `LLM_PROVIDER` | LLM provider (default: bedrock) |
| `LLM_MODEL_ID` | LLM model ID (default: amazon.nova-pro-v1:0) |
| `LLM_REGION` | AWS region for Bedrock (defaults to `AWS_REGION`) |
| `LLM_MAX_TOKENS` | Maximum tokens for LLM responses (default: 1000) |
| `LLM_TEMPERATURE` | LLM temperature (default: 0) |

API base path:

```text
/api/v1
```

---

# Completed Phases

## Phase 1 — Backend Foundation ✅

Implemented:

- Express.js REST API
- Versioned routing (`/api/v1`)
- PostgreSQL + Prisma ORM
- Shared configuration layer
- Global error handling
- Shared API response utilities
- Environment configuration

---

## Phase 2 — Authentication & Identity ✅

Implemented:

- User registration
- User login
- JWT authentication
- Password hashing
- Current-user endpoint
- Authentication middleware
- `req.user` context resolution

**Authentication flow**

```text
JWT
    ↓
Verify Token
    ↓
Load Active User
    ↓
Load Organization Unit
    ↓
Attach req.user
```

---

## Phase 3 — Organization Management ✅

Implemented:

- Organization creation
- Automatic COMPANY root creation
- Hierarchical organization structure
- Tenant isolation
- Organization unit CRUD
- Hierarchy validation
- Protected deletion rules

Supported hierarchy:

```text
COMPANY
└── DEPARTMENT
    └── TEAM
        └── GROUP
```

---

## Phase 4 — Access & Administration ✅

### Permission System

Implemented:

- Scoped permissions
- Delegated authority
- Permission history
- Permission revocation
- Transaction-safe validation

### Invitation Management

Implemented:

- Invitation creation
- Secure invitation tokens
- Invitation acceptance
- Expiration handling
- Revocation
- Capacity validation

> Email delivery is planned for a later phase.

### Member Management

Implemented:

- Member listing
- Role updates
- Unit movement
- Member removal
- Owner protection
- Permission cleanup

### Organization Capacity

Implemented:

- Parent capacity enforcement
- Allocation tracking
- Over-allocation prevention

### Organization Reorganization

Implemented:

- Unit movement
- Subtree movement
- Circular-reference protection
- Capacity validation

### Synchronization

Implemented:

- Organization revision tracking
- Stale-state detection
- Multi-user synchronization

### Concurrency Protection

Implemented:

- Serializable Prisma transactions
- Automatic retry for Prisma `P2034`
- Transaction-safe organization mutations

## Phase 5 — Document Management ✅

Database migration:

```text
20260710095413_add_document_management
```

### Database Models

```text
Document
DocumentVersion
DocumentAccessPolicy
DocumentAccessAudit
```

---

### Document Lifecycle

```text
DRAFT
    ↓
SUBMITTED
    ↓
QUEUED
    ↓
PROCESSING
    ↓
READY
    ↓
DELETED (Soft Delete)

DRAFT
    ↓
EXPIRED

PROCESSING
    ↓
FAILED

READY
    ↓
QUEUED (New version upload)
```

Documents are immutable after publication. New version uploads create new document versions and transition READY → QUEUED for reprocessing.

---

### Security Model

The platform separates administrative authority from document authorization.

```text
Administrative Permission
            ≠
Document Access
```

Document classification is metadata only.

```text
Classification
            ≠
Document Access
```

Authorization remains the responsibility of PostgreSQL. Vector search infrastructure will only index documents after authorization and processing.

```text
PostgreSQL
        ↓
Authorization

Redis + BullMQ
        ↓
Processing Queue

FastAPI AI Service
        ↓
Extraction
Chunking
Embeddings

Qdrant
        ↓
Vector Search
```

---

### Implemented Features

#### Draft Management

- Draft creation
- Draft updates
- Draft expiration
- Tenant-isolated draft listing
- Draft cleanup

#### File Storage

- Amazon S3 uploads
- SHA-256 checksum generation
- File validation
- Transaction-safe rollback
- Secure deletion

#### Publication

- Draft publication
- Initial access policy creation
- Initial audit record creation
- Immutable version creation

#### Version Management

- Version uploads
- Version history
- Current version tracking
- Presigned download URLs

#### Access Control

Supported subjects:

```text
ORGANIZATION
UNIT
ROLE
USER
```

Supported actions:

```text
QUERY
VIEW
DOWNLOAD
MANAGE_ACCESS
```

Implemented:

- ALLOW / DENY policies
- DENY precedence
- Temporary access
- Policy updates
- Policy history
- Append-only audit log
- `authorizeDocumentAction(user, documentId, action)` — validates a single document action (QUERY, VIEW, DOWNLOAD, MANAGE_ACCESS) against active policies with DENY precedence
- `authorizeQueryDocuments(user, documentIds)` — batch-authorizes document IDs for QUERY access, using `getUserUnitHierarchy` to resolve the user's organizational unit hierarchy for subject matching

#### Query Pipeline (Phase 7)

The query pipeline is implemented in `backend/src/services/query/`. The entry point is `POST /api/v1/query` (`query.controller.js` → `queryDocuments`).

```text
User Query (query, topK)
        ↓
queryCache.service.js — check Redis cache (300s TTL)
        ↓
queryAI.service.js — POST /api/v1/retrieve { query, top_k }
        ↓
query.service.js — retrieveAuthorizedCandidates(user, query, topK)
        ↓
authorizeQueryDocuments(user, documentIds) — filter to authorized docs
        ↓
reranking.service.js — score-based rerank to topK
        ↓
evidence.service.js — check sufficiency (text, score, candidates)
        ↓
contextGuard.service.js — buildSafeContext (sanitize + bound context)
        ↓
prompt.service.js — buildRAGPrompt (system + user prompt)
        ↓
llm.service.js — Bedrock Converse API (amazon.nova-pro-v1:0)
        ↓
answerValidation.service.js — validate source citations
        ↓
outputGuardrail.service.js — filter unsafe patterns
        ↓
Answer + sources + evidence + usedLLM + outputGuardPassed
```

Query response shape:

```json
{
  "query": "user question",
  "answer": "grounded response",
  "sources": [{ "index": 1, "chunkId": "...", "documentId": "...", ... }],
  "evidence": { "sufficient": true, "reason": "SUFFICIENT_EVIDENCE" },
  "usedLLM": true,
  "outputGuardPassed": true
}
```

Service files:

- `queryAI.service.js` — calls `${config.ai.url}/api/v1/retrieve` with 5-minute timeout
- `query.service.js` — `retrieveAuthorizedCandidates` orchestrator
- `reranking.service.js` — `rerankCandidates(candidates, topK)` (score-based sort + slice)
- `contextGuard.service.js` — `buildSafeContext(candidates)` (4000 char/chunk, 18000 total, sanitizes null chars and normalizes line endings)
- `context.service.js` — `buildContext(candidates)` (alternative, 3000 char/chunk, 12000 total)
- `prompt.service.js` — `buildSystemPrompt()` (14 security rules) + `buildRAGPrompt(query, context)`
- `evidence.service.js` — `checkEvidenceSufficiency(candidates)` (NO_AUTHORIZED_EVIDENCE, NO_USABLE_EVIDENCE, LOW_RELEVANCE)
- `answer.service.js` — `generateQueryAnswer(result)` (skips LLM if insufficient evidence)
- `answerValidation.service.js` — `validateGeneratedAnswer(answer, sources)` (checks [Source N] citations)
- `outputGuardrail.service.js` — `validateGeneratedAnswer(answer)` (filters system prompt, developer message, hidden instructions, chain-of-thought patterns)
- `queryCache.service.js` — `getCachedQuery`/`setCachedQuery` (Redis, 300s TTL, namespace `rag:retrieval:{topK}:{query}`)
- `llm.service.js` — `generateAnswer(prompt)` via AWS Bedrock Runtime Converse API

#### Document Lifecycle

Implemented:

- Soft delete
- Restore
- Permanent cleanup
- S3 cleanup
- Database cleanup

---

### Authorization Flow

Every document action follows the same authorization pipeline.

```text
Resolve Matching Policies
        ↓
Validate Active Policies
        ↓
Validate Temporary Access
        ↓
Apply DENY
        ↓
Apply ALLOW
        ↓
Authorize Request
```

---

### Processing Pipeline (Phase 6)

Document publication is now connected to the processing pipeline.

```text
Publish Document
        ↓
Commit Transaction
        ↓
Processing Dispatcher
        ↓
Redis Enabled?
      ┌─────────────┐
      │             │
     Yes           No
      │             │
      ▼             ▼
BullMQ Queue   Direct Processing
      │
      ▼
Document Worker
      │
      ▼
FastAPI AI Service
```

The backend is responsible for orchestration, authorization, lifecycle management, and processing state.

The AI service is responsible for:

- Content extraction
- OCR (planned)
- Chunk generation
- Embedding generation
- Vector indexing

---

### Document API Endpoints

All routes require authentication.

```text
# Drafts

POST    /drafts
POST    /drafts/:documentId/upload
DELETE  /drafts/:documentId/upload
POST    /drafts/:documentId/publish
POST    /cleanup/expired-drafts

# Documents

GET     /
GET     /:documentId
PATCH   /:documentId
DELETE  /:documentId
PATCH   /:documentId/restore
DELETE  /:documentId/cleanup

# Versions

GET     /:documentId/versions
GET     /:documentId/versions/:versionId
POST    /:documentId/versions
GET     /:documentId/download
GET     /:documentId/versions/:versionId/download

# Access

POST    /:documentId/access
POST    /:documentId/access/temporary
GET     /:documentId/access
GET     /:documentId/access/history
GET     /access/:policyId
PATCH   /access/:policyId
DELETE  /access/:policyId
```

# Platform API

## Health

```text
GET     /api/v1/health
```

---

## Authentication

```text
POST    /api/v1/auth/register
POST    /api/v1/auth/login
GET     /api/v1/auth/me
```

---

## Organization

```text
GET     /api/v1/organization
POST    /api/v1/organization
PATCH   /api/v1/organization

GET     /api/v1/organization/revision

GET     /api/v1/organization/units
POST    /api/v1/organization/units
PATCH   /api/v1/organization/units/:unitId
PATCH   /api/v1/organization/units/:unitId/move
PATCH   /api/v1/organization/units/:unitId/capacity
DELETE  /api/v1/organization/units/:unitId

GET     /api/v1/organization/members
PATCH   /api/v1/organization/members/:memberId/role
PATCH   /api/v1/organization/members/:memberId/unit
DELETE  /api/v1/organization/members/:memberId

GET     /api/v1/organization/units/:unitId/capacity
```

---

## Permissions

```text
GET     /api/v1/permissions/me
GET     /api/v1/permissions/members/:memberId

POST    /api/v1/permissions
PATCH   /api/v1/permissions/:permissionGrantId/revoke
```

---

## Invitations

```text
GET     /api/v1/invitations
POST    /api/v1/invitations

GET     /api/v1/invitations/received
PATCH   /api/v1/invitations/accept/:token

PATCH   /api/v1/invitations/:invitationId/revoke
```

## Query

```text
POST    /api/v1/query
```

Query documents with RAG. Accepts `{ query, topK }` (default 5, max 20). Returns `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`. Requires authentication.

---

# Planned Development

## Phase 6 — Document Processing ⏳

### Backend Infrastructure

- Redis queue integration (implemented; deployment verification pending)
- BullMQ workers (implemented; deployment verification pending)
- Processing dispatcher (implemented)
- Processing retries
- Processing status tracking
- Dead-letter queue

Backend processing services (`backend/src/services/document/`):

- `documentLifecycle.service.js` — draft management, publication, version upload, lifecycle transitions, soft delete/restore/cleanup
- `documentProcessingDispatcher.service.js` — `dispatchDocumentProcessing()` (Redis → BullMQ or direct)
- `documentProcessing.service.js` — `processDocument()` orchestrator (status updates, AI call, success/failure handling)
- `documentQueue.service.js` — `initializeDocumentQueue`, `addDocumentProcessingJob`, `getProcessingJOb`, `removeProcessingJob`
- `documentAI.service.js` — `buildProcessingPayload`, `processDocumentWithAI`, `handleProcessingSuccess`, `handleProcessingFailure`
- `documentHelpers.js` — `validateOrganizationMembership`, `getDocument`, `getActiveDocument`, `getDraftDocument`, `getDeletedDocument`, `getDocumentWithVersions`, `getDocumentAccessPolicy`, etc.
- `documentAccess.service.js` — access policy CRUD + `authorizeDocumentAction` + `authorizeQueryDocuments`

### AI Service

- FastAPI processing service (implemented)
- Document extraction (implemented)
- OCR support
- Chunk generation (implemented)
- Embedding generation and Qdrant indexing (implemented)
- Processing response handling

---

## Phase 7 — Retrieval Infrastructure ✅

### Vector Indexing

- Qdrant integration (implemented for version-aware indexing)
- Authorized retrieval filters (implemented via `authorizeQueryDocuments`)
- Document re-indexing semantics (pending — see Current Gaps)
- Metadata synchronization (not yet needed; vector payload mirrors document version)

### Retrieval

- Vector similarity search (implemented via `/api/v1/retrieve` on the AI service)
- Permission-aware retrieval (implemented — candidates filtered by document access policy before LLM use)
- Semantic reranking (implemented — score-based reranking in `rerankCandidates`)
- Hybrid retrieval (planned)
- Metadata filtering (planned)

---

## Phase 8 — Retrieval-Augmented Generation ✅

### Query Pipeline

```text
User Query
        ↓
Authentication
        ↓
Authentication & Authorization
        ↓
Vector Retrieval (AI service /api/v1/retrieve)
        ↓
Document Authorization (authorizeQueryDocuments)
        ↓
Reranking (score-based)
        ↓
Evidence Sufficiency Check
        ↓
Context Reconstruction (buildSafeContext, 18K char max)
        ↓
Prompt Construction (system prompt + RAG prompt)
        ↓
LLM (Bedrock Converse API)
        ↓
Answer Validation (source citation check)
        ↓
Output Guardrail (unsafe pattern filter)
        ↓
Grounded Response + Citations
```

Implemented goals:

- Vector retrieval with candidate multiplier (top_k * 5, capped at 200)
- Document authorization via PostgreSQL policies before LLM use
- Score-based reranking (`rerankCandidates`)
- Evidence sufficiency check before LLM invocation
- Context reconstruction with safe chunking and sanitization (`buildSafeContext`)
- System prompt with 14 security rules (prompt injection, knowledge boundary, etc.)
- RAG prompt construction (`buildRAGPrompt`)
- Bedrock LLM integration via Converse API
- Source citation validation (`answerValidation.service.js`)
- Output guardrail filtering unsafe patterns (`outputGuardrail.service.js`)
- Redis query caching (300s TTL)
- Evidence-based fallback (skips LLM when insufficient evidence)

Planned goals:

- Streaming responses
- Hybrid retrieval (BM25 + vector)
- Semantic reranking (cross-encoder)

---

## Phase 9 — Reliability & Performance ⏳

Implemented goals:

- Version-aware caching
- Redis caching
- Cache invalidation
- Background cleanup
- Queue optimization
- Retrieval optimization

---

## Phase 10 — Evaluation & Monitoring ⏳

Implemented goals:

- Retrieval evaluation
- Generation evaluation
- Queue monitoring
- Processing latency
- AI service monitoring
- Cost monitoring
- Security monitoring

---

## Phase 11 — Deployment ⏳

Implemented goals:

- Docker
- Production deployment
- Logging
- Observability
- Health monitoring
- Scaling
# Backend Structure

```text
backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── server.js
└── src/
    ├── app.js
    │
    ├── config/
    │   ├── ai.js
    │   ├── bullmq.js
    │   ├── config.js
    │   ├── prisma.js
    │   └── s3.js
    │
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── document.controllers.js
    │   ├── health.controller.js
    │   ├── invitation.controller.js
    │   ├── organization.controller.js
    │   ├── permission.controller.js
    │   └── query.controller.js
    │
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   ├── notFound.middleware.js
    │   └── upload.middleware.js
    │
    ├── routes/
    │   ├── auth.routes.js
    │   ├── document.routes.js
    │   ├── health.routes.js
    │   ├── index.js
    │   ├── invitation.routes.js
    │   ├── organization.routes.js
    │   ├── permission.routes.js
    │   └── query.routes.js
    │
    ├── services/
    │   ├── auth.service.js
    │   ├── document.service.js
    │   ├── invitation.service.js
    │   ├── organization.service.js
    │   ├── permission.service.js
    │   ├── s3.service.js
    │   │
    │   ├── document/
    │   │   ├── documentAccess.service.js
    │   │   ├── documentAI.service.js
    │   │   ├── documentHelpers.js
    │   │   ├── documentLifecycle.service.js
    │   │   ├── documentProcessing.service.js
    │   │   ├── documentProcessingDispatcher.service.js
    │   │   └── documentQueue.service.js
    │   │
    │   └── query/
    │       ├── answer.service.js
    │       ├── answerValidation.service.js
    │       ├── context.service.js
    │       ├── contextGuard.service.js
    │       ├── evidence.service.js
    │       ├── llm.service.js
    │       ├── outputGuardrail.service.js
    │       ├── prompt.service.js
    │       ├── query.service.js
    │       ├── queryAI.service.js
    │       ├── queryCache.service.js
    │       └── reranking.service.js
    │
    ├── workers/
    │   └── document.worker.js
    │
    └── utils/
        ├── ApiError.js
        ├── ApiResponse.js
        ├── asyncHandler.js
        ├── fileValidation.js
        ├── jwt.js
        ├── password.js
        └── serializeBigInt.js
```

---

# Current Processing Architecture

```text
Document Publication
        │
        ▼
Database Transaction
        │
        ▼
Processing Dispatcher
        │
        ├──────────────┐
        │              │
        ▼              ▼
Redis Enabled      Redis Disabled
        │              │
        ▼              ▼
BullMQ Queue    Direct Processing
        │
        ▼
Document Worker
        │
        ▼
Document Processing
        │
        ▼
FastAPI AI Service
        │
        ▼
Document Status Update (READY or FAILED)
```

```text
New Version Upload (on READY documents)
        │
        ▼
Database Transaction (status → QUEUED)
        │
        ▼
Processing Dispatcher
        ...
```

The worker processes one document at a time. New version uploads on READY documents trigger the same dispatcher flow.

---

# Next Development Step

## Phase 6 — Document Processing

### Backend

- Verify BullMQ integration in the deployment environment
- Worker retry handling
- Dead-letter queue
- Processing metrics
- Processing history

### AI Service

- End-to-end AI-service processing verification with a test Qdrant collection
- Same-version reprocessing policy
- Resolve known import issues (see ai-service.md Known Issues)

```text
POST /api/v1/process-document
GET  /api/v1/health
POST /api/v1/retrieve
```

### Processing Pipeline

```text
Download Document
        ↓
Extract Content
        ↓
OCR (Optional)
        ↓
Normalize Content
        ↓
Chunk Generation
        ↓
Embedding Generation
        ↓
Return Processing Result
```

## Phase 7 — Query (Completed)

The query pipeline is implemented end-to-end:

- POST /api/v1/query with authentication
- Redis query caching (300s TTL)
- Document authorization via PostgreSQL access policies
- Score-based reranking
- Evidence sufficiency checks before LLM invocation
- Bedrock LLM integration with security-focused system prompt
- Source citation validation and output guardrails

### Next Milestone

```text
Node.js Backend
        ↓
Authentication & Authorization
        ↓
Document Access Policies (PostgreSQL)
        ↓
Vector Retrieval (FastAPI /retrieve)
        ↓
Redis (Query Cache + Processing Queue)
        ↓
Qdrant
```

Phase 7 (authorized retrieval) is implemented. Phases 9–10 (reliability, evaluation, monitoring) and Phase 11 (deployment) remain.
