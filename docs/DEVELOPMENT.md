# RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform. Database design: [`docs/DATABASE.md`](DATABASE.md).

---

# Current Status

**Active Phase:** Phase 4 — Access & Member Management ⏳

| Area | Status |
| --- | --- |
| Backend Foundation | ✅ |
| Authentication | ✅ |
| Organization Management | ✅ |
| Organization Hierarchy | ✅ |
| Permission Engine | ✅ |
| Invitation Management | ✅ |
| Member Access | ✅ |
| Capacity Management | ⏳ |
| Member Management | ⏳ |
| Unit Reorganization | ⏳ |

---

# Phase 1 — Backend Foundation ✅

## Completed

| Area | Implementation |
| --- | --- |
| Environment | `.env`, configuration, Neon `DATABASE_URL`, JWT |
| Database | PostgreSQL, Prisma schema and client |
| Express | App, CORS, JSON parsing, database connection |
| Routing | Versioned `/api/v1`, centralized router |
| Middleware | Authentication, global error and 404 handlers |
| Utilities | `ApiResponse`, `ApiError`, `asyncHandler` |

~~~http
GET /api/v1/health
~~~

---

# Phase 2 — Authentication & Identity ✅

## Completed

* Registration and login
* JWT generation and validation
* Current user retrieval
* Password hashing and verification
* Missing and inactive user rejection
* Authentication independent of organization membership

## Endpoints

~~~http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
~~~

New users initially have:

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
* Organization structure retrieval
* Department, team, and group creation
* Hierarchy and organization isolation validation
* Unit rename and safe deletion
* Root company and non-leaf deletion protection

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

## Hierarchy

~~~text
COMPANY → DEPARTMENT → TEAM → GROUP
~~~

All other parent-child relationships are rejected.

## Unit Operation Flow

~~~text
Authenticate
→ Validate Membership
→ Validate Permission + Scope
→ Validate Organization + Hierarchy
→ Create / Update / Delete
~~~

## Deletion Rules

~~~text
COMPANY         → Cannot Delete
Has Children    → Move children first
Has Members     → Move/remove members first
Valid Leaf Unit → Can Delete
~~~

Future reorganization will validate organization ownership, hierarchy, circular references, permissions, and capacity.

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

| Concept | Purpose |
| --- | --- |
| Role | Internal organizational classification |
| Permission | What the user may do |
| Scope | Where the action is allowed |
| Delegation | Who may grant authority |
| Capacity | How much the tree may contain |

Roles do not directly grant access.

---

## 4.1 Permission Engine ✅

### Completed

* Atomic permission schema
* Scoped permission grants
* Active permission validation
* Hierarchy scope validation
* Delegation authority
* Permission revocation
* Permission history
* Member permission retrieval
* Scoped `CREATE_UNIT` enforcement

### Permissions

~~~text
INVITE_MEMBER
REMOVE_MEMBER
UPDATE_MEMBER
ASSIGN_ROLE
MOVE_MEMBER
CREATE_UNIT
UPDATE_UNIT
DELETE_UNIT
~~~

### Permission Flow

~~~text
Authenticated User
→ Find Active Grant
→ Validate Organization
→ Validate Hierarchy Scope
→ Validate Target
→ ALLOW / DENY
~~~

### Delegation Flow

~~~text
Has Permission?
→ Can Delegate?
→ Recipient Inside Scope?
→ New Scope Inside Current Scope?
→ Create Grant
~~~

Historical grants are never rewritten. Authority changes use revoke + new grant.

### Grant Lifecycle

~~~text
Grant Permission
→ Active Scoped Access
→ Use Permission
→ Revoke Grant
→ Access Denied
~~~

The complete lifecycle has been tested with `CREATE_UNIT`.

---

## 4.2 Invitation Management ✅

### Completed

* Create invitations
* Validate invitation permissions and scope
* Optional role assignment
* Secure token generation
* Received invitation retrieval by email
* Invitation acceptance
* Expiration validation
* User assignment to unit and role
* Invitation status tracking

### Flow

~~~text
Check INVITE_MEMBER
→ Validate Scope + Unit
→ Validate ASSIGN_ROLE if needed
→ Create PENDING Invitation
→ Invited User Logs In
→ Fetch Invitation by Email
→ Accept
→ Validate Token + Email + Expiry
→ Assign Unit + Role
→ Mark ACCEPTED
~~~

Permissions remain separate from membership and are granted through `PermissionGrant`.

---

## 4.3 Member Access ✅

### Completed

* List organization members
* Retrieve member role and assigned unit
* View member permission history
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

## 4.4 Capacity Management ⏳

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Capacity Allocated to Children
~~~

Example:

~~~text
Parent = 100
├── Child A = 40
├── Child B = 30
└── Remaining = 30
~~~

### Planned

* Set root capacity
* Allocate child capacity
* Calculate remaining capacity
* Prevent over-allocation
* Validate invitation acceptance
* Recalculate during reorganization

---

## 4.5 Member Management ⏳

### Planned

* Update member roles
* Move members between units
* Remove members
* Validate permission scope
* Validate capacity

---

## 4.6 Unit Reorganization ⏳

### Planned

* Move subtrees
* Change parent units
* Reassign child units
* Move members to replacement units
* Replace removable parent units
* Prevent circular hierarchy
* Validate hierarchy, permissions, and capacity

---

# Future Phases

## Phase 5 — Document Management

* Upload, metadata, versioning, and processing status
* Soft delete and recovery
* Permission-aware document access

## Phase 6 — Document Processing

* Extraction, OCR, and chunking
* Content hashing and incremental indexing
* BullMQ background processing

## Phase 7 — Retrieval Infrastructure

* Qdrant and embeddings
* Semantic and keyword search
* Metadata filtering
* Hybrid and permission-aware retrieval

## Phase 8 — RAG Pipeline

* Query processing
* Parallel retrieval and merging
* Reranking and context validation
* Answer and citation generation
* Streaming responses

## Phase 9 — Reliability & Caching

* Hallucination detection
* Answer verification
* Exact, semantic, and Redis caching
* Version-aware invalidation

## Phase 10 — Evaluation & Monitoring

* Retrieval and generation metrics
* Latency and throughput
* Cache hit rate
* Token and cost analysis
* Audit logging

## Phase 11 — Deployment

* Containerization and environment configuration
* Worker deployment
* Production PostgreSQL, Redis, and Qdrant
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

# Progress Summary

| Phase | Status |
| --- | --- |
| Backend Foundation | ✅ Completed |
| Authentication | ✅ Completed |
| Organization Management | ✅ Completed |
| Organization Hierarchy | ✅ Completed |
| Permission Engine | ✅ Completed |
| Invitation Management | ✅ Completed |
| Member Access & Permission Management | ✅ Completed |
| Capacity Management | ⏳ Next |
| Member Management | ⏳ Planned |
| Unit Reorganization | ⏳ Planned |
| Document Management | ⏳ Planned |
| Document Processing | ⏳ Planned |
| Retrieval Infrastructure | ⏳ Planned |
| RAG Pipeline | ⏳ Planned |
| Reliability & Caching | ⏳ Planned |
| Evaluation & Monitoring | ⏳ Planned |
| Deployment | ⏳ Planned |