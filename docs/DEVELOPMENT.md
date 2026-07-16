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
| Document Processing Infrastructure | ⏳ |
| AI Processing Service | ⏳ |

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

DRAFT
    ↓
EXPIRED

PROCESSING
    ↓
FAILED

READY
    ↓
DELETED (Soft Delete)
```

Documents are immutable after publication. New uploads create new document versions instead of replacing existing files.

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

---

# Planned Development

## Phase 6 — Document Processing ⏳

### Backend Infrastructure

- Redis queue integration
- BullMQ workers
- Processing dispatcher
- Processing retries
- Processing status tracking
- Dead-letter queue

### AI Service

- FastAPI processing service
- Document extraction
- OCR support
- Chunk generation
- Embedding generation
- Processing response handling

---

## Phase 7 — Retrieval Infrastructure ⏳

### Vector Indexing

- Qdrant integration
- Incremental indexing
- Document re-indexing
- Metadata synchronization

### Retrieval

- Hybrid retrieval
- Metadata filtering
- Permission-aware retrieval
- Semantic reranking

---

## Phase 8 — Retrieval-Augmented Generation ⏳

### Query Pipeline

```text
User Query
        ↓
Authentication
        ↓
Authorization
        ↓
Hybrid Retrieval
        ↓
Reranking
        ↓
Prompt Construction
        ↓
LLM
        ↓
Grounded Response
        ↓
Citations
```

Implemented goals:

- Context reconstruction
- Streaming responses
- Final authorization validation
- Hallucination reduction
- Source citations

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
    │   └── permission.controller.js
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
    │   └── permission.routes.js
    │
    ├── services/
    │   ├── auth.service.js
    │   ├── document.service.js
    │   ├── invitation.service.js
    │   ├── organization.service.js
    │   ├── permission.service.js
    │   ├── s3.service.js
    │   │
    │   └── document/
    │       ├── documentAccess.service.js
    │       ├── documentAI.service.js
    │       ├── documentHelpers.js
    │       ├── documentLifecycle.service.js
    │       ├── documentProcessing.service.js
    │       ├── documentProcessingDispatcher.service.js
    │       └── documentQueue.service.js
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
        └── password.js
```

---

# Current Processing Architecture

```text
Publish Document
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
Document Status Update
```

---

# Next Development Step

## Phase 6 — Document Processing

### Backend

- Complete BullMQ integration
- Worker retry handling
- Dead-letter queue
- Processing metrics
- Processing history

### AI Service

- FastAPI project setup
- AI service configuration
- Health endpoint
- Document processing endpoint

```text
POST /process-document
GET  /health
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

### Next Milestone

```text
Node.js Backend
        ↓
BullMQ
        ↓
FastAPI
        ↓
Qdrant
```

Once the AI service is operational, the backend processing pipeline will be complete and Phase 7 (Retrieval Infrastructure) can begin.