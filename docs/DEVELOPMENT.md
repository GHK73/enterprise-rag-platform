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
| Member Access | ✅ |
| Capacity Management | ✅ |
| Member Management | ✅ |
| Unit Reorganization | ✅ |
| Document Management | ⏳ |

---

# Phase 1 — Backend Foundation ✅

## Completed

* Environment and JWT configuration
* PostgreSQL with Prisma ORM
* Express application and database connection
* Versioned `/api/v1` routing
* Authentication middleware
* Global error and 404 handling
* `ApiResponse`, `ApiError`, and `asyncHandler`

~~~http
GET /api/v1/health
~~~

---

# Phase 2 — Authentication & Identity ✅

## Completed

* Registration and login
* JWT generation and validation
* Password hashing and verification
* Current user retrieval
* Missing and inactive user rejection
* Authentication independent of organization membership

~~~http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
~~~

New users start with:

~~~text
role   = null
unitId = null
~~~

Users cannot assign their own organization, role, unit, or permissions.

---

# Phase 3 — Organization Management ✅

## Completed

* Organization creation and update
* Automatic `COMPANY` root creation
* Creator assignment as `OWNER`
* Automatic owner permission grants
* Organization structure retrieval
* Department, team, and group creation
* Hierarchy validation
* Organization isolation
* Unit rename and safe deletion
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

GET    /api/v1/organization/members
~~~

## Operation Flow

~~~text
Authenticate
→ Validate Membership
→ Validate Permission + Scope
→ Validate Organization + Hierarchy
→ Apply Operation
~~~

---

# Phase 4 — Access & Member Management ✅

## Authorization Model

~~~text
Effective Access
=
Permission
AND
Hierarchy Scope
AND
Valid Delegation
~~~

Roles classify members but do not directly grant access.

---

## 4.1 Permission Engine ✅

## Completed

* Atomic permissions
* Scoped permission grants
* Active permission validation
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

## Permission Flow

~~~text
Authenticated User
→ Find Active Grant
→ Validate Organization
→ Validate Hierarchy Scope
→ ALLOW / DENY
~~~

## Delegation Flow

~~~text
Has Permission?
→ Can Delegate?
→ Recipient Inside Scope?
→ New Scope Inside Current Scope?
→ Create Grant
~~~

Historical grants are preserved. Authority changes use revoke + new grant.

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
* User assignment to unit and role
* Invitation status tracking
* Capacity validation during acceptance

## Flow

~~~text
Check INVITE_MEMBER
→ Validate Scope + Unit
→ Validate ASSIGN_ROLE If Needed
→ Create PENDING Invitation
→ Invited User Logs In
→ Accept Invitation
→ Validate Token + Email + Expiry
→ Validate Unit Capacity
→ Assign Unit + Role
→ Mark ACCEPTED
~~~

Permissions remain separate from membership.

---

## 4.3 Member Access ✅

## Completed

* Organization member listing
* Member role and unit retrieval
* Permission history
* Scoped permission grants
* Permission revocation
* Active and revoked grant visibility

---

## 4.4 Capacity Management ✅

## Completed

* Optional organization and unit capacity
* Capacity configuration and updates
* Direct member usage calculation
* Child allocation calculation
* Remaining capacity calculation
* Parent capacity enforcement
* Child over-allocation prevention
* Invitation capacity enforcement
* Transaction-safe invitation acceptance

## Capacity Formula

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Child Allocations
~~~

## Endpoints

~~~http
GET   /api/v1/organization/units/:unitId/capacity
PATCH /api/v1/organization/units/:unitId/capacity
~~~

---

## 4.5 Member Management ✅

## Completed

### Update Member Role

* `ASSIGN_ROLE` permission validation
* Hierarchy scope validation
* Organization isolation
* Owner protection
* Frontend integration

~~~http
PATCH /api/v1/organization/members/:memberId/role
~~~

### Move Member

* Source and destination `MOVE_MEMBER` scope validation
* Organization isolation
* Owner protection
* Destination capacity validation
* Same-unit movement rejection
* Frontend integration

~~~http
PATCH /api/v1/organization/members/:memberId/unit
~~~

### Remove Member

* `REMOVE_MEMBER` permission validation
* Hierarchy scope validation
* Organization isolation
* Owner protection
* Active permission revocation
* Organization membership removal
* Frontend integration

~~~http
DELETE /api/v1/organization/members/:memberId
~~~

## Member Management Flow

~~~text
Select Member
→ Validate Permission + Scope
→ Validate Organization
→ Protect OWNER
→ Apply Operation
→ Update UI
~~~

---

## 4.6 Unit Reorganization ✅

## Completed

* Move units and subtrees
* Change parent units
* Organization isolation
* Strict hierarchy validation
* Circular reference protection
* Source scope validation
* Destination scope validation
* Destination capacity validation
* Same-parent movement prevention
* Immediate hierarchy updates
* Frontend integration

## Hierarchy Rules

~~~text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → Cannot Move
~~~

## Endpoint

~~~http
PATCH /api/v1/organization/units/:unitId/move
~~~

## Flow

~~~text
Select Unit
→ Select New Parent
→ Validate Organization
→ Validate Hierarchy
→ Prevent Circular Reference
→ Validate Source MOVE_UNIT Scope
→ Validate Destination MOVE_UNIT Scope
→ Validate Destination Capacity
→ Move Unit
→ Update Hierarchy
~~~

## Tested

* Successful unit movement
* Same-parent prevention
* Hierarchy validation
* Destination capacity rejection
* Permission denial
* Destination scope denial

---

# Phase 5 — Document Management ⏳

## Architecture Design

Before implementation, the document storage and access architecture will be finalized.

~~~text
PostgreSQL + Prisma
→ Documents
→ Versions
→ Metadata
→ Chunks
→ Processing status
→ Access policies
→ Audit history

Amazon S3
→ Original files
→ Versioned file objects
→ Processed artifacts

Qdrant
→ Embedding vectors
→ Chunk and document references
→ Filtered vector retrieval

Redis + BullMQ
→ Caching
→ Background document processing
~~~

## Planned Data Flow

~~~text
Upload
→ Validate Access
→ Create Document Record
→ Store File in S3
→ Create Document Version
→ Queue Processing Job
→ Extract Text / OCR
→ Chunk Content
→ Store Chunk Metadata
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
* Download through authorized presigned URLs

## Planned Access Model

~~~text
Organization Isolation
→ Document Access Policy
→ Hierarchy / User / Role Scope
→ Time Validity
→ Retrieval-Time Validation
~~~

Access policies will support:

~~~text
ORGANIZATION
UNIT
USER
ROLE
~~~

Each policy can include:

~~~text
validFrom
validUntil
revokedAt
~~~

This supports permanent access, temporary restrictions, expiring access, and scheduled document release without moving files or rebuilding embeddings.

---

# Future Phases

## Phase 6 — Document Processing

* Text extraction and OCR
* Chunking
* Content hashing
* Incremental indexing
* BullMQ workers

## Phase 7 — Retrieval Infrastructure

* Qdrant integration
* Embeddings
* Semantic search
* Keyword search
* Metadata filtering
* Hybrid retrieval
* Permission-aware retrieval

## Phase 8 — RAG Pipeline

* Query processing
* Parallel retrieval
* Result merging
* Reranking
* Context validation
* Answer generation
* Citation generation
* Streaming

## Phase 9 — Reliability & Caching

* Hallucination detection
* Answer verification
* Exact and semantic caching
* Redis caching
* Version-aware invalidation

## Phase 10 — Evaluation & Monitoring

* Retrieval metrics
* Generation metrics
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