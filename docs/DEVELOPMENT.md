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

# Recent Changes (2026-09-20)

## Multi-Tenant Organization Isolation

Added `organization_id` to all processing and retrieval flows for tenant isolation:

### Backend Changes

- `documentAI.service.js` — Processing payload now includes `organization_id` from `document.organizationId`
- `queryAI.service.js` — `retrieveFromAI` accepts and forwards `organizationId` to AI service `/retrieve`
- `queryCache.service.js` — `buildCacheKey`, `getCachedQuery`, and `setCachedQuery` now include `organizationId` in the Redis cache key for per-tenant isolation
- `query.service.js` — `retrieveAuthorizedCandidates` extracts `organizationId` from `user.unit.organizationId` and passes it through to AI retrieval and caching

### AI Service Changes

- `ProcessDocumentRequest` and `RetrievalRequest` schemas now require `organization_id`
- `QdrantVectorStore` creates a payload index on `organization_id` (keyword)
- `upsert_chunks` stores `organization_id` in every point payload
- `search` filters by `organization_id` via Qdrant `Filter(must=[FieldCondition(key="organization_id", match=MatchValue(value=organization_id))])`
- `RetrievalService` passes `organization_id` through to vector search
- `DocumentProcessingService` passes `organization_id` to `upsert_chunks`

### Bug Fixes

- Resolved circular self-import in `app/services/extractors/base.py` (BaseExtractor now defined locally)
- Added missing `ApiResponse` model in `app/schemas/api.py`
- Deleted legacy `app/schemas/retrieval/` package directory that conflicted with `app/schemas/retrieval.py` module

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

#### Query Pipeline (Phase 7/8)

The query pipeline is implemented in `backend/src/services/query/`. Entry point: `POST /api/v1/query` (`query.controller.js` → `queryDocuments`). See the **Query** section under Platform API for the full API contract.

Full pipeline:

```text
Frontend POST /api/v1/query { query, topK }
         ↓
Auth middleware (JWT) + req.user context
         ↓
query.service.js → retrieveAuthorizedCandidates(user, query, topK)
         ↓
organizationId = user.unit.organizationId
         ↓
queryCache.service.js — Redis cache (key: rag:retrieval:{organizationId}:{topK}:{query}, 300s TTL)
         ↓ (cache miss)
queryAI.service.js — POST /api/v1/retrieve { query, top_k, organization_id }
         ↓
authorizeQueryDocuments(user, documentIds) — PostgreSQL policy filter
         ↓
reranking.service.js — score-based rerank to topK
         ↓
evidence.service.js — check sufficiency (NO_AUTHORIZED_EVIDENCE, NO_USABLE_EVIDENCE, LOW_RELEVANCE)
         ↓
contextGuard.service.js — buildSafeContext (4000 char/chunk, 18000 total, sanitizes null chars)
         ↓
prompt.service.js — buildRAGPrompt (system prompt with 14 security rules + RAG prompt)
         ↓
llm.service.js — Bedrock Converse API (amazon.nova-pro-v1:0)
         ↓
answerValidation.service.js — validate [Source N] citations
         ↓
outputGuardrail.service.js — filter unsafe patterns
         ↓
Answer + sources + evidence + usedLLM + outputGuardPassed
```

Service files reference:

| Service | Key Function | Purpose |
| --- | --- | --- |
| `query.controller.js` | `queryDocuments` | Express handler; validates input, returns ApiResponse |
| `query.service.js` | `retrieveAuthorizedCandidates` | Orchestrator; extracts organizationId, cache, AI call, auth, rerank, LLM |
| `queryAI.service.js` | `retrieveFromAI` | Calls AI service `/api/v1/retrieve` with organization_id |
| `queryCache.service.js` | `getCachedQuery` / `setCachedQuery` | Tenant-scoped Redis cache (300s TTL) |
| `reranking.service.js` | `rerankCandidates` | Score-based sort + slice to topK |
| `contextGuard.service.js` | `buildSafeContext` | Sanitize + bound context (18K char max) |
| `prompt.service.js` | `buildSystemPrompt` / `buildRAGPrompt` | 14 security rules + RAG prompt construction |
| `evidence.service.js` | `checkEvidenceSufficiency` | Evidence check before LLM |
| `answer.service.js` | `generateQueryAnswer` | LLM answer generation via Bedrock |
| `answerValidation.service.js` | `validateGeneratedAnswer` | Source citation validation |
| `outputGuardrail.service.js` | `validateGeneratedAnswer` | Unsafe pattern filtering |
| `llm.service.js` | `generateAnswer` | AWS Bedrock Runtime Converse API call |

Full request/response contract documented in the **Query** section under Platform API.

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

Document publication triggers the processing pipeline:

```text
Document Publication
         │
         ▼
Database Transaction
         ▼
Processing Dispatcher
         │
         ├──────────────┐
         │              │
         ▼              ▼
   Redis Enabled   Redis Disabled
         │              │
         ▼              ▼
   BullMQ Queue    Direct Processing
         │
         ▼
   Document Worker
         │
         ▼
   Document Processing → buildProcessingPayload
   (document_id, version_id, organization_id, file_url)
         │
         ▼
   FastAPI AI Service (POST /api/v1/process-document)
         │
         ▼
   Document Status Update (READY or FAILED)
```

New version uploads on READY documents trigger the same dispatcher flow (status → QUEUED). The worker processes one document at a time.

The backend is responsible for orchestration, authorization, lifecycle management, and processing state (`document_id`, `version_id`, `organization_id`, `file_url`).

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

Query documents with RAG. Requires JWT authentication. The `organization_id` is extracted from the authenticated user's organizational unit context (`req.user.unit.organizationId`), not from the request body.

### Request

```json
{
  "query": "What is the company's refund policy?",
  "topK": 5
}
```

| Field | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | — | Must be non-empty after trimming |
| `topK` | integer | No | 5 | Must be an integer between 1 and 20 |

### Response (200)

```json
{
  "statusCode": 200,
  "data": {
    "query": "What is the company's refund policy?",
    "answer": "The company offers a 30-day money-back guarantee...",
    "sources": [
      {
        "index": 1,
        "chunkId": "abc123",
        "documentId": "doc1",
        "versionId": "ver1",
        "pageNumber": 3,
        "score": 0.92
      }
    ],
    "evidence": {
      "sufficient": true,
      "reason": "SUFFICIENT_EVIDENCE"
    },
    "usedLLM": true,
    "outputGuardPassed": true
  },
  "message": "Query executed successfully."
}
```

### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `query` | string | The normalized user query |
| `answer` | string | Grounded LLM response, or a fallback message if evidence is insufficient |
| `sources` | array | Source chunks cited in the answer, with `chunkId`, `documentId`, `versionId`, `pageNumber`, `score` |
| `evidence` | object | Sufficiency check: `{ sufficient: bool, reason: string }` — reasons: `SUFFICIENT_EVIDENCE`, `NO_AUTHORIZED_EVIDENCE`, `NO_USABLE_EVIDENCE`, `LOW_RELEVANCE` |
| `usedLLM` | boolean | Whether the LLM was invoked (false if evidence was insufficient) |
| `outputGuardPassed` | boolean | Whether the output passed safety guardrails |

### Error Responses

```json
// 400 — Invalid input
{
  "statusCode": 400,
  "data": null,
  "message": "Query is required."
}

// 400 — topK out of range
{
  "statusCode": 400,
  "data": null,
  "message": "topK must be an integer between 1 and 20."
}

// 401 — Missing or invalid token
{
  "statusCode": 401,
  "data": null,
  "message": "Unauthorized."
}
```

### Flow Summary

The full pipeline is documented in **Query Pipeline (Phase 7/8)** under Phase 5 above. Briefly: auth → organization context → Redis cache → AI service `/retrieve` → document authorization → rerank → evidence check → LLM → validation/guards → response.

---

# Planned Development

## Phase 6 — Document Processing ⏳

### Backend Infrastructure

- Redis queue integration (implemented; deployment verification pending)
- BullMQ workers (implemented; deployment verification pending)
- Processing dispatcher (implemented)
- Processing retries (todo)
- Dead-letter queue (todo)

Backend processing services (`backend/src/services/document/`):

- `documentLifecycle.service.js` — draft management, publication, version upload, lifecycle transitions, soft delete/restore/cleanup
- `documentProcessingDispatcher.service.js` — `dispatchDocumentProcessing()` (Redis → BullMQ or direct)
- `documentProcessing.service.js` — `processDocument()` orchestrator (status updates, AI call, success/failure handling)
- `documentQueue.service.js` — `initializeDocumentQueue`, `addDocumentProcessingJob`, `getProcessingJob`, `removeProcessingJob`
- `documentAI.service.js` — `buildProcessingPayload`, `processDocumentWithAI`, `handleProcessingSuccess`, `handleProcessingFailure`
- `documentHelpers.js` — `validateOrganizationMembership`, `getDocument`, `getActiveDocument`, `getDraftDocument`, `getDeletedDocument`, `getDocumentWithVersions`, `getDocumentAccessPolicy`
- `documentAccess.service.js` — access policy CRUD + `authorizeDocumentAction` + `authorizeQueryDocuments`

### AI Service

- FastAPI processing service (implemented) — see `docs/ai-service.md`
- Document extraction (implemented; BaseExtractor import fixed)
- OCR support (planned)
- Chunk generation (implemented; ChunkingConfig not yet enforced)
- Embedding generation and Qdrant indexing (implemented)
- Multi-tenant organization isolation (implemented — `organization_id` in schema, payload index, search filter)
- Processing response handling (implemented)

---

## Phase 7 — Retrieval Infrastructure ✅

### Vector Indexing

- Qdrant integration (implemented for version-aware indexing)
- Organization-aware payload indexing (`organization_id` keyword index)
- Authorized retrieval filters (implemented via `authorizeQueryDocuments`)
- Document re-indexing semantics (pending — see Current Gaps)
- Metadata synchronization (not yet needed; vector payload mirrors document version)

### Retrieval

- Vector similarity search (implemented via `/api/v1/retrieve` on the AI service, with `organization_id` filtering)
- Permission-aware retrieval (implemented — candidates filtered by document access policy before LLM use)
- Semantic reranking (implemented — score-based reranking in `rerankCandidates`)
- Hybrid retrieval (planned)
- Metadata filtering (planned)

---

## Phase 8 — Retrieval-Augmented Generation ✅

The query pipeline is fully implemented. See **Query Pipeline (Phase 7/8)** in Phase 5 for the detailed service-level diagram, and the **Query** API section under Platform API for the frontend contract.

### Query Pipeline (High-Level)

```text
User Query
         ↓
Authentication
         ↓
Organization Context (user.unit.organizationId)
         ↓
Redis Cache Check → Vector Retrieval (AI service /retrieve with organization_id)
         ↓
Document Authorization → Reranking → Evidence Sufficiency
         ↓
Context Reconstruction → Prompt Construction → LLM (Bedrock Converse)
         ↓
Answer Validation → Output Guardrail → Grounded Response

Implemented goals:

- Vector retrieval with candidate multiplier (top_k * 5, capped at 200)
- Organization-aware retrieval (`organization_id` passed to AI service and Qdrant filter)
- Tenant-scoped Redis query cache (300s TTL)
- Document authorization via PostgreSQL policies before LLM use
- Score-based reranking, evidence sufficiency check, context reconstruction
- System prompt with 14 security rules, RAG prompt construction
- Bedrock LLM integration via Converse API (amazon.nova-pro-v1:0)
- Source citation validation and output guardrail filtering
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

---

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

# Appendix: Backend Structure
