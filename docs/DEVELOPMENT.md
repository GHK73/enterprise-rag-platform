# Enterprise RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend.

Database design: `docs/DATABASE.md`

---

# Current Status

**Active Phase:** Phase 9 — Reliability & Performance

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
| Query Pipeline | ✅ |
| Version-Aware Caching | ✅ |
| Cache Invalidation | ✅ |

---

# Recent Changes (2026-09-27)

## Version-Aware Query Caching & Cache Invalidation

Implemented version-aware caching to prevent stale retrieval results after document updates and cache invalidation after successful document processing.

### Backend Changes

- `queryCache.service.js` — Tenant-scoped Redis retrieval cache with SHA-256 query keys, 300-second TTL, cached candidate arrays, and organization-level invalidation.
- `documentProcessing.service.js` — Version-safe processing status updates using `documentId`, `currentVersionId`, and current status; successful processing invalidates the organization's retrieval cache.
- `query.service.js` — Validates cached candidates against `currentVersionId`, re-fetches stale cache results from the AI service, and filters candidates to the current version.
- `documentAccess.service.js` — `authorizeQueryDocuments` filters to READY documents with a current version and returns `{ documentId, currentVersionId }`.

### Behavior

- Cached candidates are checked against the current document version.
- Stale cached candidates trigger fresh AI retrieval.
- Candidates from superseded versions are excluded before reranking and LLM generation.
- Old document versions remain stored in Qdrant for historical/version-aware functionality.
- Successful document processing invalidates tenant retrieval caches.

---

# Recent Changes (2026-09-20)

## Multi-Tenant Organization Isolation

Added `organization_id` throughout processing and retrieval flows.

### Backend

- `documentAI.service.js` includes `organization_id` in processing payloads.
- `queryAI.service.js` forwards `organizationId` to the AI service.
- `queryCache.service.js` includes organization ID in cache keys.
- `query.service.js` obtains organization ID from `user.unit.organizationId`.

### AI Service

- Processing and retrieval schemas require `organization_id`.
- Qdrant has an `organization_id` payload index.
- Every indexed point stores `organization_id`.
- Qdrant search filters by `organization_id`.
- Retrieval and document processing propagate organization ID.

### Bug Fixes

- Fixed circular self-import in `app/services/extractors/base.py`.
- Added missing `ApiResponse` model.
- Removed the conflicting legacy `app/schemas/retrieval/` package.

---

# Local Setup

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

## Environment Variables

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
| `REDIS_ENABLED` | Enable or disable Redis |
| `REDIS_URL` | Managed Redis connection |
| `AI_SERVICE_URL` | FastAPI AI service endpoint |
| `LLM_PROVIDER` | LLM provider |
| `LLM_MODEL_ID` | Bedrock model ID |
| `LLM_REGION` | Bedrock AWS region |
| `LLM_MAX_TOKENS` | Maximum LLM response tokens |
| `LLM_TEMPERATURE` | LLM temperature |

API base path:

```text
/api/v1
```

---

# Completed Phases

## Phase 1 — Backend Foundation ✅

Implemented:

- Express.js REST API
- Versioned routing
- PostgreSQL + Prisma ORM
- Shared configuration
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

Authentication flow:

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

Email delivery is planned for a later phase.

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

---

# Phase 5 — Document Management ✅

Database migration:

```text
20260710095413_add_document_management
```

### Database Models

- `Document`
- `DocumentVersion`
- `DocumentAccessPolicy`
- `DocumentAccessAudit`

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
DELETED

DRAFT → EXPIRED
PROCESSING → FAILED
READY → QUEUED
```

New version uploads transition READY → QUEUED and create a new immutable document version.

### Security Model

Administrative authority and document authorization are separate.

```text
Administrative Permission
        ≠
Document Access
```

Document classification is metadata only and does not determine access.

PostgreSQL is the source of truth for authorization.

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
- Old versions retained for historical use

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
- `authorizeDocumentAction`
- `authorizeQueryDocuments`
- Current-version validation for query candidates

---

## Query Pipeline

Entry point:

```text
POST /api/v1/query
```

Pipeline:

```text
Frontend
 ↓
JWT Authentication
 ↓
Organization Context
 ↓
Redis Retrieval Cache
 ↓
AI Service Retrieval
 ↓
PostgreSQL Document Authorization
 ↓
Current Version Validation
 ↓
Reranking
 ↓
Evidence Sufficiency
 ↓
Safe Context
 ↓
RAG Prompt
 ↓
Amazon Bedrock / Nova Pro
 ↓
Citation Validation
 ↓
Output Guardrail
 ↓
Answer + Sources
```

### Service Files

| Service | Key Function | Purpose |
| --- | --- | --- |
| `query.controller.js` | `queryDocuments` | Query endpoint handler |
| `query.service.js` | `retrieveAuthorizedCandidates` | Query orchestration |
| `queryAI.service.js` | `retrieveFromAI` | AI retrieval call |
| `queryCache.service.js` | `getCachedQuery`, `setCachedQuery` | Tenant-scoped Redis cache |
| `reranking.service.js` | `rerankCandidates` | Score-based reranking |
| `contextGuard.service.js` | `buildSafeContext` | Context sanitization and limits |
| `prompt.service.js` | `buildRAGPrompt` | Secure RAG prompt |
| `evidence.service.js` | `checkEvidenceSufficiency` | Evidence validation |
| `answer.service.js` | `generateQueryAnswer` | Answer generation |
| `answerValidation.service.js` | `validateGeneratedAnswer` | Citation validation |
| `outputGuardrail.service.js` | `validateGeneratedAnswer` | Output safety filtering |
| `llm.service.js` | `generateAnswer` | Bedrock Converse API |

### Query API

```text
POST /api/v1/query
```

Requires JWT authentication. `organization_id` is derived from the authenticated user's organization context and is not accepted from the request body.

Request fields:

| Field | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | — | Non-empty after trimming |
| `topK` | integer | No | 5 | 1–20 |

Response fields:

| Field | Type | Description |
| --- | --- | --- |
| `query` | string | Normalized user query |
| `answer` | string | Grounded LLM response or evidence fallback |
| `sources` | array | Cited document chunks |
| `evidence` | object | Evidence sufficiency result |
| `usedLLM` | boolean | Whether the LLM was invoked |
| `outputGuardPassed` | boolean | Output guard result |

Evidence reasons:

```text
SUFFICIENT_EVIDENCE
NO_AUTHORIZED_EVIDENCE
NO_USABLE_EVIDENCE
LOW_RELEVANCE
```

Error responses include validation failures and authentication failures.

---

# Authorization Flow

Every document action follows:

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

# Processing Pipeline

Document publication triggers processing:

```text
Document Publication
 ↓
Database Transaction
 ↓
Processing Dispatcher
 ↓
BullMQ or Direct Processing
 ↓
Document Worker
 ↓
Document Processing
 ↓
FastAPI AI Service
 ↓
Document Status READY / FAILED
```

Processing payload contains:

```text
document_id
version_id
organization_id
file_url
```

The backend owns orchestration, authorization, lifecycle management, and processing state.

The AI service owns:

- Content extraction
- OCR support (planned)
- Chunk generation
- Embedding generation
- Vector indexing

---

# Document API Endpoints

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

---

# Platform API

## Health

```text
GET /api/v1/health
```

## Authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

## Organization

```text
GET    /api/v1/organization
POST   /api/v1/organization
PATCH  /api/v1/organization

GET    /api/v1/organization/revision

GET    /api/v1/organization/units
POST   /api/v1/organization/units
PATCH  /api/v1/organization/units/:unitId
PATCH  /api/v1/organization/units/:unitId/move
PATCH  /api/v1/organization/units/:unitId/capacity
DELETE /api/v1/organization/units/:unitId

GET    /api/v1/organization/members
PATCH  /api/v1/organization/members/:memberId/role
PATCH  /api/v1/organization/members/:memberId/unit
DELETE /api/v1/organization/members/:memberId

GET    /api/v1/organization/units/:unitId/capacity
```

## Permissions

```text
GET   /api/v1/permissions/me
GET   /api/v1/permissions/members/:memberId
POST  /api/v1/permissions
PATCH /api/v1/permissions/:permissionGrantId/revoke
```

## Invitations

```text
GET   /api/v1/invitations
POST  /api/v1/invitations
GET   /api/v1/invitations/received
PATCH /api/v1/invitations/accept/:token
PATCH /api/v1/invitations/:invitationId/revoke
```

## Query

```text
POST /api/v1/query
```

---

# Planned Development

## Phase 6 — Document Processing ✅

### Backend Infrastructure

- Redis queue integration
- BullMQ workers
- Processing dispatcher
- Processing retries — todo
- Dead-letter queue — todo

### Backend Processing Services

- `documentLifecycle.service.js`
- `documentProcessingDispatcher.service.js`
- `documentProcessing.service.js`
- `documentQueue.service.js`
- `documentAI.service.js`
- `documentHelpers.js`
- `documentAccess.service.js`

### AI Service

- FastAPI processing service
- Document extraction
- OCR support — planned
- Chunk generation
- Embedding generation
- Qdrant indexing
- Multi-tenant organization isolation
- Processing response handling

---

## Phase 7 — Retrieval Infrastructure ✅

### Vector Indexing

- Qdrant integration
- Version-aware indexing
- Organization-aware payload indexing
- Permission-aware retrieval through backend authorization
- Old document versions retained in Qdrant
- Document re-indexing semantics — pending
- Metadata synchronization — not yet needed

### Retrieval

- Vector similarity search
- Organization filtering
- Permission-aware retrieval
- Score-based reranking
- Hybrid retrieval — planned
- Metadata filtering — planned

---

## Phase 8 — Retrieval-Augmented Generation ✅

Implemented:

- Vector retrieval with candidate multiplier
- Organization-aware retrieval
- Tenant-scoped Redis query cache
- Document authorization before LLM use
- Current-version validation
- Score-based reranking
- Evidence sufficiency checks
- Safe context reconstruction
- Secure RAG prompt construction
- Bedrock Converse integration with `amazon.nova-pro-v1:0`
- Source citation validation
- Output guardrail filtering
- Evidence-based LLM fallback

Planned:

- Streaming responses
- Hybrid retrieval (BM25 + vector)
- Semantic reranking (cross-encoder)

---

## Phase 9 — Reliability & Performance ✅

Implemented:

- Version-aware caching
- Redis caching
- Cache invalidation
- Background cleanup
- Queue optimization
- Retrieval optimization

### Version-Aware Caching

- Redis keys use organization ID, topK, and SHA-256 query hash.
- Cached candidates are validated against the document's current version.
- Stale candidates trigger fresh AI retrieval.
- Candidates from superseded versions are excluded.
- Successful document processing invalidates tenant retrieval cache.
- Processing status updates are scoped to the expected document version.

---

## Phase 10 — Evaluation & Monitoring ⏳

Planned:

- Retrieval evaluation
- Generation evaluation
- Queue monitoring
- Processing latency
- AI service monitoring
- Cost monitoring
- Security monitoring

---

## Phase 11 — Deployment ⏳

Planned:

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
    ├── config/
    │   ├── ai.js
    │   ├── bullmq.js
    │   ├── config.js
    │   ├── prisma.js
    │   └── s3.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── document.controllers.js
    │   ├── health.controller.js
    │   ├── invitation.controller.js
    │   ├── organization.controller.js
    │   ├── permission.controller.js
    │   └── query.controller.js
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   ├── notFound.middleware.js
    │   └── upload.middleware.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── document.routes.js
    │   ├── health.routes.js
    │   ├── index.js
    │   ├── invitation.routes.js
    │   ├── organization.routes.js
    │   ├── permission.routes.js
    │   └── query.routes.js
    ├── services/
    │   ├── auth.service.js
    │   ├── document.service.js
    │   ├── invitation.service.js
    │   ├── organization.service.js
    │   ├── permission.service.js
    │   ├── s3.service.js
    │   ├── document/
    │   │   ├── documentAccess.service.js
    │   │   ├── documentAI.service.js
    │   │   ├── documentHelpers.js
    │   │   ├── documentLifecycle.service.js
    │   │   ├── documentProcessing.service.js
    │   │   ├── documentProcessingDispatcher.service.js
    │   │   └── documentQueue.service.js
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
    ├── workers/
    │   └── document.worker.js
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
