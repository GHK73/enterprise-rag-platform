# RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform.

Database architecture: [`docs/DATABASE.md`](DATABASE.md)

---

# Current Status

**Active Phase:** Phase 5 — Document Management ⏳

| Area                         | Status |
| ---------------------------- | ------ |
| Backend Foundation           | ✅      |
| Authentication               | ✅      |
| Organization Management      | ✅      |
| Access & Administration      | ✅      |
| Organization Synchronization | ✅      |
| Concurrency Protection       | ✅      |
| Document Management          | ⏳      |

---

# Phase 1 — Backend Foundation ✅

## Completed

* Node.js and Express backend
* PostgreSQL with Prisma ORM
* Environment and JWT configuration
* Versioned `/api/v1` routing
* Authentication middleware
* Global error and 404 handling
* Reusable API response and error utilities

```http
GET /api/v1/health
```

---

# Phase 2 — Authentication & Identity ✅

## Completed

* User registration and login
* Password hashing and JWT authentication
* Current user retrieval
* Inactive and missing user rejection
* Authentication independent of organization membership

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

New users start without organization membership:

```text
role   = null
unitId = null
```

---

# Phase 3 — Organization Management ✅

## Completed

* Organization creation and update
* Automatic `COMPANY` root creation
* Creator assignment as `OWNER`
* Automatic owner permission grants
* Organization structure retrieval
* Unit creation, rename, movement, and deletion
* Organization isolation and hierarchy validation
* Root and non-leaf deletion protection

## Hierarchy

```text
COMPANY → DEPARTMENT → TEAM → GROUP
```

## Endpoints

```http
POST   /api/v1/organization
GET    /api/v1/organization
PATCH  /api/v1/organization

GET    /api/v1/organization/units
POST   /api/v1/organization/units
PATCH  /api/v1/organization/units/:unitId
DELETE /api/v1/organization/units/:unitId
PATCH  /api/v1/organization/units/:unitId/move

GET    /api/v1/organization/members
```

---

# Phase 4 — Access & Organization Administration ✅

## 4.1 Permission Engine ✅

Authorization model:

```text
Permission
+
Hierarchy Scope
+
Delegation Authority
```

## Completed

* Atomic permissions
* Scoped permission grants
* Hierarchy scope validation
* Delegation authority
* Permission revocation and history
* Member permission retrieval
* Scoped operation enforcement

## Permissions

```text
INVITE_MEMBER
REMOVE_MEMBER
UPDATE_MEMBER
ASSIGN_ROLE
MOVE_MEMBER

CREATE_UNIT
UPDATE_UNIT
DELETE_UNIT
MOVE_UNIT
```

Roles classify members. Permissions control operations.

---

## 4.2 Invitation Management ✅

## Completed

* Invitation creation
* Permission and scope validation
* Optional role assignment
* Secure token generation
* Received invitation retrieval
* Expiration validation
* Invitation acceptance
* Unit and role assignment
* Capacity validation
* Invitation status tracking

---

## 4.3 Capacity Management ✅

## Completed

* Capacity configuration and updates
* Direct member usage calculation
* Child allocation calculation
* Parent capacity enforcement
* Child over-allocation prevention
* Invitation capacity enforcement

```text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Child Allocations
```

```http
GET   /api/v1/organization/units/:unitId/capacity
PATCH /api/v1/organization/units/:unitId/capacity
```

---

## 4.4 Member Management ✅

## Completed

* Organization member listing
* Member role and unit retrieval
* Role updates
* Member movement and removal
* Owner protection
* Permission and scope validation
* Destination capacity validation
* Permission revocation on removal

```http
GET    /api/v1/organization/members
PATCH  /api/v1/organization/members/:memberId/role
PATCH  /api/v1/organization/members/:memberId/unit
DELETE /api/v1/organization/members/:memberId
```

---

## 4.5 Unit Reorganization ✅

## Completed

* Unit and subtree movement
* Strict hierarchy validation
* Circular reference protection
* Source and destination scope validation
* Destination capacity validation
* Same-parent movement prevention

```text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → Cannot Move
```

---

## 4.6 Organization Synchronization ✅

Revision-based stale-state detection provides lightweight multi-user synchronization without WebSockets.

## Completed

* Monotonically increasing organization revision
* Revision updates inside organization-changing transactions
* Organization revision endpoint
* Frontend stale-state detection support
* Periodic and visibility-based revision checking
* Consistent snapshot refresh support

## Covered Changes

* Organization updates
* Unit creation, rename, deletion, and movement
* Capacity updates
* Member role updates, movement, and removal
* Invitation acceptance

```http
GET /api/v1/organization/revision
```

```text
Organization Mutation
+
Revision Increment
→ Commit Together
or
→ Roll Back Together
```

---

## 4.7 Concurrency Protection ✅

Capacity-sensitive operations are protected from parallel requests validating against stale state.

## Completed

* PostgreSQL serializable transactions
* Automatic retry for Prisma `P2034` conflicts
* Transaction-aware hierarchy scope checks
* Fresh validation inside transactions
* Transactional revision increments

## Protected Operations

* Capacity updates
* Member movement
* Unit and subtree movement
* Invitation acceptance

```text
Start Serializable Transaction
→ Read Fresh State
→ Validate Constraints
→ Apply Mutation
→ Increment Revision
→ Commit

Conflict
→ Retry with Fresh State
```

---

# Phase 5 — Document Management ⏳

Detailed document models and architecture are maintained in `docs/DATABASE.md`.

## 5.1 Document Architecture & Database Design ⏳

Current work:

* Document lifecycle
* Document and version models
* S3 storage mapping
* Data classification
* Document access policies
* Temporary access
* Access change history
* Soft deletion and cleanup boundaries
* Future processing and Qdrant references

## Agreed Lifecycle

```text
DRAFT
→ SUBMITTED
→ QUEUED
→ PROCESSING
→ READY
```

Additional states:

```text
PROCESSING → FAILED → RETRY

DRAFT → EXPIRED → CLEANUP

READY → DELETED → ASYNC CLEANUP
```

A file may remain temporarily in S3 as a draft, but cannot remain permanently as unused S3-only storage.

Initial rules:

```text
Maximum draft staging period
→ 24 hours

Maximum temporary access period
→ 7 days
```

These limits should remain configurable.

## Agreed Security Boundaries

```text
Administrative Permission
≠
Document Access

Data Classification
≠
Document Access

PostgreSQL
→ Authorization authority

Qdrant
→ Retrieval infrastructure
```

Document access will support:

```text
ORGANIZATION
UNIT
ROLE
USER
```

Initial access actions:

```text
QUERY
VIEW
DOWNLOAD
MANAGE_ACCESS
```

Every access mutation must create an append-only audit record in the same transaction.

```text
No access mutation
without an audit record.
```

Access changes must take effect through PostgreSQL without requiring vector reindexing.

## Planned Phase 5 Features

* Draft document creation and expiry
* S3 upload and private object storage
* Document metadata and classification
* Document publication
* Immutable document versions
* Processing status tracking
* Document access policies
* Temporary access
* Access audit history
* Controlled access changes
* Immediate revocation
* Authorized downloads
* Soft deletion
* Asynchronous cleanup preparation

## Phase 5 Implementation Order

```text
Finalize DATABASE.md
→ Update schema.prisma
→ Create Prisma migration
→ Implement Document Lifecycle
→ Integrate S3 Uploads
→ Implement Publication
→ Implement Access Policies
→ Implement Access Audit History
→ Implement Temporary Access
→ Implement Authorized Downloads
→ Implement Soft Delete and Cleanup Jobs
→ Test Complete Document Lifecycle
```

---

# Future Phases

## Phase 6 — Document Processing

* Layout-aware extraction
* OCR
* Pages and content blocks
* Tables, charts, images, and diagrams
* Chunking and content hashing
* BullMQ processing workers

## Phase 7 — Retrieval Infrastructure

* Qdrant integration
* Embeddings
* Vector placement
* Tenant-aware routing
* Semantic and keyword search
* Permission-aware retrieval

## Phase 8 — RAG Pipeline

* Query processing
* Parallel retrieval
* Context reconstruction
* Reranking
* Final authorization validation
* Answer and citation generation
* Streaming

## Phase 9 — Reliability & Caching

* Hallucination detection
* Answer verification
* Redis caching
* Version-aware invalidation

## Phase 10 — Evaluation & Monitoring

* Retrieval and generation metrics
* Latency and throughput
* Cache hit rate
* Token and cost analysis
* Security and audit monitoring

## Phase 11 — Deployment

* Containerization
* Worker deployment
* Production PostgreSQL
* Amazon S3
* Redis and Qdrant
* Monitoring and observability

---

# Current Backend Structure

```text
backend/
├── prisma/
│   └── schema.prisma
├── docs/
│   └── DATABASE.md
├── server.js
├── .env
└── src/
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── routes/
    ├── services/
    ├── utils/
    └── app.js
```

---

# Next Development Step

```text
Phase 5.1 — Finalize Document Database Design

Finalize Phase 5 Enums
→ Finalize Document Model
→ Finalize DocumentVersion Model
→ Finalize DocumentAccessPolicy Model
→ Finalize DocumentAccessAudit Model
→ Validate Referential Integrity
→ Update schema.prisma
```
