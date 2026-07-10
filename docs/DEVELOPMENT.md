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

Completed:

* Node.js and Express backend
* PostgreSQL with Prisma ORM
* Environment and JWT configuration
* Versioned `/api/v1` routing
* Authentication middleware
* Global error and 404 handling
* Reusable API response and error utilities

---

# Phase 2 — Authentication & Identity ✅

Completed:

* User registration and login
* Password hashing and JWT authentication
* Current-user retrieval
* Inactive and missing-user rejection
* Authentication independent of organization membership

New users begin with no organization membership.

---

# Phase 3 — Organization Management ✅

Completed:

* Organization creation and updates
* Automatic `COMPANY` root creation
* Creator assignment as `OWNER`
* Automatic owner permission grants
* Organization structure retrieval
* Unit creation, rename, movement, and deletion
* Organization isolation and hierarchy validation
* Root and non-leaf deletion protection

Hierarchy:

```text
COMPANY → DEPARTMENT → TEAM → GROUP
```

---

# Phase 4 — Access & Organization Administration ✅

## 4.1 Permission Engine ✅

Completed:

* Atomic permissions
* Scoped permission grants
* Hierarchy scope validation
* Delegation authority
* Permission revocation and history
* Member permission retrieval
* Scoped operation enforcement

Authorization model:

```text
Permission
+
Hierarchy Scope
+
Delegation Authority
```

---

## 4.2 Invitation Management ✅

Completed:

* Invitation creation and validation
* Optional role assignment
* Secure token generation
* Received invitation retrieval
* Invitation acceptance and expiration
* Unit and role assignment
* Capacity validation
* Invitation status tracking

External email delivery is not implemented yet.

---

## 4.3 Capacity Management ✅

Completed:

* Capacity configuration and updates
* Direct-member usage calculation
* Child-allocation calculation
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

---

## 4.4 Member Management ✅

Completed:

* Organization member listing
* Member role and unit retrieval
* Role updates
* Member movement and removal
* Owner protection
* Permission and scope validation
* Destination capacity validation
* Permission revocation on removal

---

## 4.5 Unit Reorganization ✅

Completed:

* Unit and subtree movement
* Strict hierarchy validation
* Circular-reference protection
* Source and destination scope validation
* Destination capacity validation
* Same-parent movement prevention

---

## 4.6 Organization Synchronization ✅

Completed:

* Monotonically increasing organization revision
* Transactional revision updates
* Revision endpoint
* Frontend stale-state detection support
* Periodic and visibility-based checking
* Consistent snapshot refresh support

Covered changes include organization, unit, capacity, member, and invitation mutations.

---

## 4.7 Concurrency Protection ✅

Completed:

* PostgreSQL serializable transactions
* Automatic retry for Prisma `P2034` conflicts
* Transaction-aware hierarchy checks
* Fresh validation inside transactions
* Transactional revision increments

Protected operations:

* Capacity updates
* Member movement
* Unit and subtree movement
* Invitation acceptance

---

# Phase 5 — Document Management ⏳

Detailed architecture is maintained in `docs/DATABASE.md`.

## 5.1 Document Architecture & Database Design ✅

Completed:

* Document lifecycle design
* Document and immutable version models
* S3 storage mapping architecture
* Data classification model
* Document access policy model
* Temporary access design
* Append-only access audit model
* Soft-deletion and cleanup boundaries
* Authorization resolution rules
* Phase 5 service invariants
* Referential-integrity review
* Prisma schema update
* Prisma validation
* Phase 5 database migration
* Prisma Client regeneration

Migration:

```text
20260710095413_add_document_management
```

Added models:

```text
Document
DocumentVersion
DocumentAccessPolicy
DocumentAccessAudit
```

Document lifecycle:

```text
DRAFT
→ SUBMITTED
→ QUEUED
→ PROCESSING
→ READY
```

Additional states:

```text
PROCESSING → FAILED
DRAFT → EXPIRED
READY → DELETED
```

Initial configurable limits:

```text
Draft staging period → 24 hours
Temporary access     → 7 days
```

Security boundaries:

```text
Administrative Permission ≠ Document Access
Data Classification       ≠ Document Access

PostgreSQL → Authorization Authority
Qdrant     → Retrieval Infrastructure
```

Access subjects:

```text
ORGANIZATION
UNIT
ROLE
USER
```

Access actions:

```text
QUERY
VIEW
DOWNLOAD
MANAGE_ACCESS
```

Authorization resolution:

```text
Matching DENY
→ DENY

No DENY + Matching ALLOW
→ ALLOW

No Matching Policy
→ DENY
```

Every access mutation must create an append-only audit record in the same transaction.

---

## 5.2 Document Lifecycle ⏳

Next implementation work:

* Draft document creation
* Draft expiry handling
* Metadata and classification updates
* Lifecycle transition validation
* Publication preparation
* Document listing and retrieval

---

## 5.3 S3 Uploads ⏳

Planned:

* Private S3 storage
* Draft uploads
* File metadata and checksum storage
* Published version storage
* Draft cleanup
* Short-lived authorized download URLs

---

## 5.4 Document Publication & Versions ⏳

Planned:

* Draft publication
* Initial access validation
* Immutable document versions
* Current-version management
* Processing queue preparation
* New-version uploads

---

## 5.5 Document Access Management ⏳

Planned:

* Organization, unit, role, and user policies
* Independent access actions
* Permanent and temporary access
* Explicit `DENY` precedence
* Immediate revocation
* Controlled policy updates
* Transactional audit creation

---

## 5.6 Access History ⏳

Planned:

* Append-only audit history
* Previous and new policy state
* Actor and subject tracking
* Change reasons
* Expiration and revocation events

---

## 5.7 Downloads, Deletion & Cleanup ⏳

Planned:

* Authorized downloads
* Soft deletion
* Immediate retrieval blocking
* Cache invalidation preparation
* Asynchronous S3 and vector cleanup preparation

---

# Future Phases

## Phase 6 — Document Processing

* Layout-aware extraction and OCR
* Pages and content blocks
* Tables, charts, images, and diagrams
* Chunking and content hashing
* BullMQ processing workers

## Phase 7 — Retrieval Infrastructure

* Qdrant integration
* Embeddings and vector placement
* Tenant-aware routing
* Hybrid search
* Permission-aware retrieval

## Phase 8 — RAG Pipeline

* Query processing
* Context reconstruction and reranking
* Final authorization validation
* Grounded answers and citations
* Streaming

## Phase 9 — Reliability & Caching

* Hallucination detection
* Answer verification
* Redis caching
* Version-aware invalidation

## Phase 10 — Evaluation & Monitoring

* Retrieval and generation metrics
* Latency and throughput
* Cache and cost analysis
* Security monitoring

## Phase 11 — Deployment

* Containerization
* Worker deployment
* Production infrastructure
* Monitoring and observability

---

# Current Backend Structure

```text
backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── docs/
│   └── DATABASE.md
├── server.js
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
Phase 5.2 — Document Lifecycle

Implement Draft Creation
→ Implement Draft Expiry
→ Implement Metadata Updates
→ Implement Lifecycle Validation
→ Implement Document Retrieval
```
