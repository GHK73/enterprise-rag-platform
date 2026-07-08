# RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform.

Database design: [`docs/DATABASE.md`](DATABASE.md)

---

# Current Status

**Active Phase:** Phase 4.5 — Member Management ⏳

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
| Member Management | ⏳ |
| Unit Reorganization | ⏳ |

---

# Phase 1 — Backend Foundation ✅

## Completed

* Environment configuration and JWT setup
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

## Unit Operation Flow

~~~text
Authenticate
→ Validate Membership
→ Validate Permission + Scope
→ Validate Organization + Hierarchy
→ Apply Operation
~~~

## Deletion Rules

~~~text
COMPANY         → Cannot Delete
Has Children    → Reject
Has Members     → Reject
Valid Leaf Unit → Delete
~~~

---

# Phase 4 — Access & Member Management ⏳

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

If capacity is missing or full, acceptance is rejected and the invitation remains `PENDING`.

Permissions remain separate from membership.

---

## 4.3 Member Access ✅

## Completed

* List organization members
* Retrieve member role and assigned unit
* View permission history
* Grant scoped permissions
* Revoke active permissions
* View active and revoked grants

~~~text
Select Member
→ View Permission History
→ Grant / Revoke Permission
→ Authorization Changes Immediately
~~~

---

## 4.4 Capacity Management ✅

## Completed

* Optional organization capacity
* Root and child capacity configuration
* Capacity updates
* Safe capacity increases and decreases
* Direct member usage calculation
* Child allocation calculation
* Remaining capacity calculation
* Parent capacity enforcement
* Child over-allocation prevention
* Invitation capacity enforcement
* Capacity API and frontend integration

## Capacity Formula

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Child Allocations
~~~

## Rules

~~~text
New Capacity
>=
Direct Members + Child Allocations
~~~

For child units:

~~~text
Child Allocation
<=
Parent Capacity
− Parent Direct Members
− Sibling Allocations
~~~

When updating a child allocation, its previous allocation is excluded before calculating available parent capacity.

Capacity validation and membership assignment during invitation acceptance execute in the same database transaction.

## Endpoints

~~~http
GET   /api/v1/organization/units/:unitId/capacity
PATCH /api/v1/organization/units/:unitId/capacity
~~~

---

## 4.5 Member Management ⏳

## Completed

### Update Member Role ✅

* `ASSIGN_ROLE` permission validation
* Hierarchy scope validation
* Organization isolation
* Owner protection
* Role update API
* Frontend integration

~~~http
PATCH /api/v1/organization/members/:memberId/role
~~~

~~~text
Select Member
→ Check ASSIGN_ROLE
→ Validate Scope
→ Protect OWNER
→ Update Role
~~~

### Move Member Between Units ✅

* `MOVE_MEMBER` permission validation
* Source unit scope validation
* Destination unit scope validation
* Organization isolation
* Owner protection
* Destination capacity validation
* Same-unit movement rejection
* Member unit update API
* Frontend integration

~~~http
PATCH /api/v1/organization/members/:memberId/unit
~~~

~~~text
Select Member
→ Validate Source MOVE_MEMBER Scope
→ Validate Destination MOVE_MEMBER Scope
→ Validate Organization
→ Protect OWNER
→ Validate Destination Capacity
→ Move Member
~~~

## Next

### Remove Member ⏳

Planned validation:

~~~text
Select Member
→ Check REMOVE_MEMBER
→ Validate Scope
→ Validate Organization
→ Protect OWNER
→ Remove Member From Organization
~~~

---

## 4.6 Unit Reorganization ⏳

## Planned

* Move units and subtrees
* Change parent units
* Prevent circular hierarchy
* Validate hierarchy relationships
* Validate permission scope
* Preserve organization isolation
* Validate destination capacity
* Recalculate capacity after movement

## Planned Flow

~~~text
Select Unit
→ Select New Parent
→ Validate Organization
→ Validate Hierarchy
→ Prevent Circular Reference
→ Validate Permission Scope
→ Validate Capacity
→ Move Subtree
~~~

---

# Future Phases

## Phase 5 — Document Management

* Upload and metadata
* Versioning
* Processing status
* Soft delete and recovery
* Permission-aware document access

## Phase 6 — Document Processing

* Extraction and OCR
* Chunking
* Content hashing
* Incremental indexing
* BullMQ background processing

## Phase 7 — Retrieval Infrastructure

* Qdrant
* Embeddings
* Semantic and keyword search
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
* Exact query cache
* Semantic cache
* Redis cache
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
* Redis and Qdrant
* Monitoring and observability

---

# Current Backend Structure

~~~text
backend/
├── prisma/
│   └── schema.prisma
├── server.js
├── .env
└── src/
    ├── config/
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── health.controller.js
    │   ├── invitation.controller.js
    │   ├── organization.controller.js
    │   └── permission.controller.js
    ├── middleware/
    ├── routes/
    │   ├── auth.routes.js
    │   ├── health.routes.js
    │   ├── invitation.routes.js
    │   ├── organization.routes.js
    │   └── permission.routes.js
    ├── services/
    │   ├── auth.services.js
    │   ├── invitation.service.js
    │   ├── organization.service.js
    │   └── permission.service.js
    ├── utils/
    └── app.js
~~~

---

# Next Development Step

~~~text
Phase 4.5 — Remove Member

Backend Service
→ Controller
→ Route
→ Frontend Integration
→ Test Permission + Scope + Owner Protection
~~~

After Remove Member is complete:

~~~text
Phase 4.5 Member Management ✅
→ Phase 4.6 Unit Reorganization
~~~