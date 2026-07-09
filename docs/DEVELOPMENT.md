# RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform.

Database design: [`docs/DATABASE.md`](DATABASE.md)

---

# Current Status

**Active Phase:** Phase 5 — Document Management ⏳

| Area | Status |
| --- | --- |
| Backend Foundation | ✅ |
| Authentication | ✅ |
| Organization Management | ✅ |
| Organization Hierarchy | ✅ |
| Permission Engine | ✅ |
| Invitation Management | ✅ |
| Member Management | ✅ |
| Capacity Management | ✅ |
| Unit Reorganization | ✅ |
| Organization Sync | ⏳ |
| Document Management | ⏳ |

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

~~~http
GET /api/v1/health
~~~

---

# Phase 2 — Authentication & Identity ✅

## Completed

* User registration and login
* Password hashing and verification
* JWT generation and validation
* Current user retrieval
* Inactive and missing user rejection
* Authentication independent of organization membership

~~~http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
~~~

New users start without organization membership:

~~~text
role   = null
unitId = null
~~~

---

# Phase 3 — Organization Management ✅

## Completed

* Organization creation and update
* Automatic `COMPANY` root creation
* Creator assignment as `OWNER`
* Automatic owner permission grants
* Organization structure retrieval
* Unit creation, rename, movement, and deletion
* Organization isolation
* Hierarchy validation
* Root and non-leaf deletion protection

## Hierarchy

~~~text
COMPANY → DEPARTMENT → TEAM → GROUP
~~~

## Endpoints

~~~http
POST   /api/v1/organization
GET    /api/v1/organization
PATCH  /api/v1/organization

GET    /api/v1/organization/units
POST   /api/v1/organization/units
PATCH  /api/v1/organization/units/:unitId
DELETE /api/v1/organization/units/:unitId
PATCH  /api/v1/organization/units/:unitId/move

GET    /api/v1/organization/members
~~~

---

# Phase 4 — Access & Organization Administration ✅

## 4.1 Permission Engine ✅

Authorization is based on:

~~~text
Permission
+
Hierarchy Scope
+
Delegation Authority
~~~

## Completed

* Atomic permissions
* Scoped permission grants
* Hierarchy scope validation
* Delegation authority
* Permission revocation and history
* Member permission retrieval
* Scoped operation enforcement

## Permissions

~~~text
INVITE_MEMBER
REMOVE_MEMBER
UPDATE_MEMBER
ASSIGN_ROLE
MOVE_MEMBER

CREATE_UNIT
UPDATE_UNIT
DELETE_UNIT
MOVE_UNIT
~~~

Roles classify members, while permissions control operations.

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

~~~text
Create Invitation
→ User Logs In
→ Accept Invitation
→ Validate Token + Email + Expiry
→ Validate Capacity
→ Assign Unit + Role
→ Mark ACCEPTED
~~~

---

## 4.3 Capacity Management ✅

## Completed

* Capacity configuration and updates
* Direct member usage calculation
* Child allocation calculation
* Parent capacity enforcement
* Child over-allocation prevention
* Invitation capacity enforcement

## Capacity Formula

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Child Allocations
~~~

~~~http
GET   /api/v1/organization/units/:unitId/capacity
PATCH /api/v1/organization/units/:unitId/capacity
~~~

---

## 4.4 Member Management ✅

## Completed

* Organization member listing
* Member role and unit retrieval
* Role updates
* Member movement
* Member removal
* Owner protection
* Permission and scope validation
* Destination capacity validation
* Permission revocation on removal

~~~http
GET    /api/v1/organization/members
PATCH  /api/v1/organization/members/:memberId/role
PATCH  /api/v1/organization/members/:memberId/unit
DELETE /api/v1/organization/members/:memberId
~~~

---

## 4.5 Unit Reorganization ✅

## Completed

* Unit and subtree movement
* Strict hierarchy validation
* Circular reference protection
* Source and destination scope validation
* Destination capacity validation
* Same-parent movement prevention

## Hierarchy Rules

~~~text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → Cannot Move
~~~

~~~http
PATCH /api/v1/organization/units/:unitId/move
~~~

---

## 4.6 Organization Synchronization ✅

The organization uses revision-based stale-state detection instead of full-page refreshes or WebSockets.

Each organization stores a monotonically increasing revision:

~~~text
Organization
└── revision
~~~

Every successful organization-changing transaction increments the revision.
## Remaining

* Protect capacity-sensitive operations from concurrent mutations
* Prevent parallel requests from validating against the same stale state
* Add transaction conflict and retry handling where required

## Covered Changes

* Organization updates
* Unit creation
* Unit rename
* Unit deletion
* Unit movement
* Capacity updates
* Member role updates
* Member movement
* Member removal
* Invitation acceptance

Mutation and revision increment occur in the same database transaction.

~~~text
Organization Change
+
Revision Increment
→ Commit Together
or
→ Roll Back Together
~~~

## Endpoint

~~~http
GET /api/v1/organization/revision
~~~

## Synchronization Flow

~~~text
Frontend Loads Organization
→ Store Current Revision
→ Check Revision Periodically
→ Check Again When Tab Becomes Visible

Revision Unchanged
→ No Action

Revision Changed
→ Show Updates Available
→ Refresh Organization Data
→ Update Local State
→ Store Latest Revision
~~~

This provides lightweight multi-user change detection without WebSocket complexity.

---

# Phase 5 — Document Management ⏳

## Architecture

~~~text
PostgreSQL + Prisma
→ Documents
→ Versions
→ Metadata
→ Processing Status
→ Access Policies
→ Audit History

Amazon S3
→ Original Files
→ Versioned Objects
→ Processed Artifacts

Qdrant
→ Embeddings
→ Chunk References
→ Filtered Vector Retrieval

Redis + BullMQ
→ Caching
→ Background Processing
~~~

## Planned Lifecycle

~~~text
Upload
→ Validate Access
→ Create Document Record
→ Store File in S3
→ Create Version
→ Queue Processing
→ Extract Text / OCR
→ Chunk Content
→ Generate Embeddings
→ Index in Qdrant
~~~

## Planned Features

* Document upload and metadata
* S3 object storage
* Document versioning
* Processing status tracking
* Permission-aware access
* Time-based access policies
* Soft delete and recovery
* Authorized downloads

## Access Model

~~~text
Organization Isolation
→ Access Policy
→ Organization / Unit / User / Role
→ Time Validity
→ Retrieval-Time Validation
~~~

Policies may include:

~~~text
validFrom
validUntil
revokedAt
~~~

---

# Future Phases

## Phase 6 — Document Processing

* Text extraction and OCR
* Chunking and content hashing
* Incremental indexing
* BullMQ workers

## Phase 7 — Retrieval Infrastructure

* Qdrant integration
* Embeddings
* Semantic and keyword search
* Metadata filtering
* Hybrid retrieval
* Permission-aware retrieval

## Phase 8 — RAG Pipeline

* Query processing
* Parallel retrieval
* Reranking
* Context validation
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
* Audit logging

## Phase 11 — Deployment

* Containerization
* Worker deployment
* Production PostgreSQL
* Amazon S3
* Redis
* Qdrant
* Monitoring and observability

---

# Current Backend Structure

~~~text
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
~~~

---

# Next Development Step

~~~text
Phase 5.1 — Document Architecture & Database Design

PostgreSQL Data Model
→ S3 Storage Model
→ Document Version Model
→ Access Policy Model
→ Chunk and Qdrant Mapping
→ Processing Lifecycle
→ Finalize DATABASE.md
→ Update schema.prisma
~~~