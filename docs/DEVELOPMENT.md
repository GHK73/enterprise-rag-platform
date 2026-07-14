# Enterprise RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend.

Database design: [`docs/DATABASE.md`](DATABASE.md)

---

# Current Status

**Active Phase:** Phase 6 — Document Processing

| Area | Status |
| --- | --- |
| Backend Foundation | ✅ |
| Authentication | ✅ |
| Organization Management | ✅ |
| Access & Administration | ✅ |
| Organization Synchronization | ✅ |
| Concurrency Protection | ✅ |
| Document Management | ✅ |
| Document Processing | ⏳ |

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
| `NODE_ENV` | Environment |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry |
| `AWS_REGION` | S3 region |
| `AWS_ACCESS_KEY_ID` | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `AWS_S3_BUCKET` | Document storage bucket |

API base path: `/api/v1`

---

# Completed Phases

## Phase 1–2 — Foundation & Authentication ✅

* Express API with versioned routing (`/api/v1`)
* PostgreSQL + Prisma ORM
* JWT authentication middleware and `req.user` context
* User registration, login, and current-user retrieval
* Password hashing, global error handling, shared API utilities

**Auth flow:**

```text
JWT Verification → Load Active User + Organization Unit → Attach req.user
```

---

## Phase 3 — Organization Management ✅

* Organization CRUD with automatic COMPANY root
* Hierarchy: `COMPANY → DEPARTMENT → TEAM → GROUP`
* Tenant isolation and hierarchy validation
* Protected root, child-unit, and member-containing unit deletion

---

## Phase 4 — Access & Administration ✅

* **Permissions:** atomic/scoped grants, delegation authority, history, revocation, transaction-aware validation
* **Invitations:** creation, secure tokens, acceptance, expiration, revocation, capacity checks *(email delivery not yet implemented)*
* **Capacity:** parent enforcement, allocation tracking, over-allocation prevention
* **Members:** listing, role updates, movement, removal, owner protection, permission cleanup
* **Reorganization:** unit/subtree movement with circular-reference and capacity validation
* **Synchronization:** organization revision tracking for stale-state detection
* **Concurrency:** serializable transactions with Prisma `P2034` retry on protected mutations

---

## Phase 5 — Document Management ✅

Database migration: `20260710095413_add_document_management`

**Models:** `Document`, `DocumentVersion`, `DocumentAccessPolicy`, `DocumentAccessAudit`

**Document lifecycle:**

```text
DRAFT → SUBMITTED → QUEUED → PROCESSING → READY
DRAFT → EXPIRED
PROCESSING → FAILED
READY → DELETED (soft delete, restorable)
```

**Security model:**

```text
Administrative Permission ≠ Document Access
Classification ≠ Document Access

PostgreSQL → authorization authority
Qdrant → retrieval infrastructure (planned)
```

**Implemented capabilities:**

* Draft creation, updates, expiration, and tenant-isolated listing
* S3 upload with SHA-256 checksums, file validation, and transaction-safe rollback
* Draft publication with initial access policies and audit records
* Immutable versioning and new-version uploads for published documents
* Access policies (ORGANIZATION, UNIT, ROLE, USER) with DENY precedence and temporary access
* Append-only access audit history
* Presigned download URLs with authorization checks
* Soft delete, restore, and hard cleanup (S3 + database)

**Access authorization flow:**

```text
Resolve Matching Policies → Validate Active/Temporary Access → Apply DENY → Apply ALLOW
```

**Access actions:** `QUERY`, `VIEW`, `DOWNLOAD`, `MANAGE_ACCESS`

### Document API Endpoints

All routes under `/api/v1/documents` require authentication.

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

**Remaining before Phase 6:** wire publication to a processing queue (status transitions to `QUEUED` / `PROCESSING` / `READY`).

---

# Other API Routes

```text
GET     /api/v1/health

POST    /api/v1/auth/register
POST    /api/v1/auth/login
GET     /api/v1/auth/me

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

GET     /api/v1/permissions/me
GET     /api/v1/permissions/members/:memberId
POST    /api/v1/permissions
PATCH   /api/v1/permissions/:permissionGrantId/revoke

GET     /api/v1/invitations
POST    /api/v1/invitations
GET     /api/v1/invitations/received
PATCH   /api/v1/invitations/accept/:token
PATCH   /api/v1/invitations/:invitationId/revoke
```

---

# Future Roadmap

## Phase 6 — Document Processing ⏳

Redis + BullMQ workers, OCR and content extraction, chunking, embeddings, processing retries, dead-letter queue, status updates (`QUEUED → PROCESSING → READY | FAILED`).

## Phase 7 — Retrieval Infrastructure ⏳

Qdrant integration, hybrid retrieval, metadata filtering, permission-aware search, reranking, incremental indexing.

## Phase 8 — RAG Pipeline ⏳

Query processing, context reconstruction, final authorization validation, streaming responses, citations, hallucination reduction.

## Phase 9 — Reliability & Caching ⏳

Version-aware cache invalidation, retrieval caching, background cleanup, performance optimization.

## Phase 10 — Evaluation & Monitoring ⏳

Retrieval/generation quality metrics, latency and queue monitoring, cost and security monitoring.

## Phase 11 — Deployment ⏳

Docker, production infrastructure, logging, and observability.

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
    │   ├── config.js
    │   ├── prisma.js
    │   └── s3.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── document.controllers.js
    │   ├── health.controller.js
    │   ├── invitation.controller.js
    │   ├── organization.controller.js
    │   └── permission.controller.js
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
    │   └── permission.routes.js
    ├── services/
    │   ├── auth.services.js
    │   ├── document.service.js          # re-exports document/*
    │   ├── document/
    │   │   ├── documentAccess.service.js
    │   │   ├── documentHelpers.js
    │   │   └── documentLifecycle.service.js
    │   ├── invitation.service.js
    │   ├── organization.service.js
    │   ├── permission.service.js
    │   └── s3.service.js
    └── utils/
        ├── ApiError.js
        ├── ApiResponse.js
        ├── asyncHandler.js
        ├── fileValidation.js
        ├── jwt.js
        └── password.js
```

---

# Next Development Step

```text
Phase 6 — Document Processing

→ Redis + BullMQ queue setup
→ Worker: extract content, chunk, embed
→ Qdrant indexing on READY
→ Processing status tracking and retry handling
→ Connect publish flow to queue (SUBMITTED → QUEUED)
```
