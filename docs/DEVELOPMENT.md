# RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend. Database design: [`docs/DATABASE.md`](DATABASE.md).

---

# Current Status

**Active Phase:** Phase 4 — Access & Member Management ⏳

```text
Backend Foundation          ✅
Authentication              ✅
Organization Management     ✅
Organization Hierarchy      ✅
Permission Schema           ✅
Capacity Schema             ✅
Invitation Schema           ✅
Permission Services         ⏳
Invitation Services         ⏳
Member Management           ⏳
```

---

# Phase 1 — Backend Foundation ✅

## Completed

| Area        | Implementation                                           |
| ----------- | -------------------------------------------------------- |
| Environment | `.env`, configuration, Neon `DATABASE_URL`, JWT settings |
| Database    | Prisma setup, schema, generated client                   |
| Express     | App setup, CORS, JSON parsing, database connection       |
| Routing     | Versioned `/api/v1`, centralized router                  |
| Middleware  | Global error and 404 handlers                            |
| Utilities   | `ApiResponse`, `ApiError`, `asyncHandler`                |

```http
GET /api/v1/health
```

---

# Phase 2 — Authentication & Identity ✅

## Completed

| Area              | Implementation                                        |
| ----------------- | ----------------------------------------------------- |
| Registration      | User account creation                                 |
| Login             | Authentication and JWT generation                     |
| Current User      | Authenticated user retrieval                          |
| Password Security | Hashing and verification                              |
| Authentication    | JWT validation and current user loading               |
| User Validation   | Missing and inactive users rejected                   |
| Membership Design | Authentication independent of organization membership |

## Endpoints

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

## Flow

```text
Register
   ↓
User Created
   ↓
Login
   ↓
Generate JWT
   ↓
Verify Protected Request
   ↓
Load User
```

New users initially have:

```text
role   = null
unitId = null
```

Users cannot assign their own organization unit, role, or permissions.

---

# Phase 3 — Organization Management ✅

## Completed

| Area                   | Implementation                               |
| ---------------------- | -------------------------------------------- |
| Architecture           | Organization service, controller, and routes |
| Security               | JWT and organization membership validation   |
| Organization Creation  | Transaction-based creation                   |
| Root Unit              | Automatic `COMPANY` creation                 |
| Owner Assignment       | Creator assigned `OWNER` and root unit       |
| Organization Details   | Retrieve organization information            |
| Organization Update    | Update name and description                  |
| Unit Retrieval         | Retrieve complete organization structure     |
| Unit Creation          | Create departments, teams, and groups        |
| Hierarchy Validation   | Enforce valid parent-child relationships     |
| Organization Isolation | Prevent cross-organization operations        |
| Unit Update            | Rename non-`COMPANY` units                   |
| Unit Deletion          | Delete valid leaf units                      |
| Company Protection     | Prevent root `COMPANY` deletion              |
| Deletion Protection    | Prevent unsafe hierarchy deletion            |

## Endpoints

```http
POST   /api/v1/organization
GET    /api/v1/organization
PATCH  /api/v1/organization

GET    /api/v1/organization/units
POST   /api/v1/organization/units
PATCH  /api/v1/organization/units/:unitId
DELETE /api/v1/organization/units/:unitId
```

## Organization Creation

```text
Authenticated User
        ↓
Validate Existing Membership
        ↓
Prisma Transaction
   ├── Create Organization
   ├── Create COMPANY Unit
   └── Assign Creator as OWNER
        ↓
Commit / Rollback
```

## Organization Hierarchy

```text
COMPANY → DEPARTMENT → TEAM → GROUP
```

Valid relationships:

```text
COMPANY    → DEPARTMENT
DEPARTMENT → TEAM
TEAM       → GROUP
```

All other parent-child relationships are rejected.

## Unit Management

```text
Authenticated User
        ↓
Validate Membership
        ↓
Validate Access
        ↓
Validate Target Unit
        ↓
Validate Organization + Hierarchy
        ↓
Create / Update / Delete
```

## Deletion & Replacement Rules

```text
COMPANY         → Cannot Delete
Has Children    → Reassign children first, then delete
Has Members     → Move/remove members first, then delete
Valid Leaf Unit → Can Delete
```

Direct deletion remains blocked when a unit has children or members. Future reorganization operations will allow them to be moved to valid replacement units before deletion.

Replacement must validate:

* Organization ownership
* Hierarchy relationships
* Circular references
* Required permissions
* Capacity constraints

---

# Phase 4 — Access & Member Management ⏳

The database foundation is prepared for hybrid authorization, tree capacity, and invitation-based membership.

## Schema Foundation

| Area                  | Status        |
| --------------------- | ------------- |
| Internal Roles        | ✅ Implemented |
| Atomic Permissions    | ✅ Implemented |
| Permission Grants     | ✅ Implemented |
| Hierarchy Scope       | ✅ Implemented |
| Permission Delegation | ✅ Implemented |
| Grant Revocation      | ✅ Implemented |
| Tree Capacity         | ✅ Implemented |
| Invitations           | ✅ Implemented |

## Authorization Model

```text
Effective Access
=
Permission
AND
Hierarchy Scope
AND
Valid Delegation
```

The system separates:

```text
Role        → Internal organizational classification
Permission  → What the user may do
Scope       → Where the action is allowed
Delegation  → Who granted the authority
Capacity    → How much the tree may contain
```

Roles do not directly grant access.

## Permission Flow

```text
Authenticated User
        ↓
Find Active Permission Grant
        ↓
Validate Organization
        ↓
Validate Hierarchy Scope
        ↓
Validate Target Resource
        ↓
ALLOW / DENY
```

## Delegation Flow

```text
Has Permission?
        ↓
Can Delegate?
        ↓
Recipient Inside Scope?
        ↓
New Scope Inside Current Scope?
        ↓
Create Permission Grant
```

Historical grants are never rewritten. Replacing an authority requires revoking the old grant and creating a new grant.

## Invitation Flow

```text
Check INVITE_MEMBER
        ↓
Validate Scope + Target Unit
        ↓
Role Selected?
   ├── No  → MEMBER
   └── Yes → Check ASSIGN_ROLE
        ↓
Create PENDING Invitation
        ↓
User Accepts
        ↓
Validate Token + Email + Expiry
        ↓
Validate Tree Capacity
        ↓
Assign Unit + Role
        ↓
Mark ACCEPTED
```

Permissions are granted separately through `PermissionGrant`.

## Capacity Model

```text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Capacity Allocated to Children
```

Capacity belongs to the unit tree, not individual users.

```text
Parent Capacity = 100

├── Child A = 40
├── Child B = 30
└── Parent Remaining = 30
```

---

# Phase 4 Implementation Roadmap

## 4.1 Permission Engine

* Check active permission grants
* Validate hierarchy scope
* Validate delegation authority
* Revoke permission grants
* Replace authorities through new grants

## 4.2 Capacity Management

* Set root company capacity
* Allocate capacity to child units
* Calculate remaining capacity
* Prevent over-allocation
* Validate capacity during member acceptance
* Recalculate constraints during reorganization

## 4.3 Invitation Management

* Create invitations
* Validate `INVITE_MEMBER`
* Validate `ASSIGN_ROLE`
* Generate secure tokens
* Accept invitations
* Revoke invitations
* Handle expiration

## 4.4 Member Management

* List organization members
* Update member roles
* Move members between units
* Remove members
* Validate permission scope
* Validate capacity

## 4.5 Unit Reorganization

* Move entire subtrees
* Reassign child units
* Move members to replacement units
* Replace removable parent units
* Prevent circular hierarchy
* Validate hierarchy and capacity

---

# Future Backend Phases

## Phase 5 — Document Management

* Document upload
* Metadata storage
* Document versioning
* Processing status
* Soft delete and recovery
* Permission-aware document access

## Phase 6 — Document Processing

* Text extraction
* OCR
* Chunking
* Content hashing
* Incremental indexing
* Background processing with BullMQ

## Phase 7 — Vector & Retrieval Infrastructure

* Qdrant integration
* Embedding generation
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
* Streaming responses

## Phase 9 — Reliability & Caching

* Hallucination detection
* Answer verification
* Exact query cache
* Semantic cache
* Redis response cache
* Version-aware invalidation

## Phase 10 — Evaluation & Monitoring

* Retrieval metrics
* Generation metrics
* Latency tracking
* Cache hit rate
* Token usage
* Cost analysis
* Audit logging

## Phase 11 — Deployment

* Containerization
* Environment configuration
* Worker deployment
* Production database
* Redis and Qdrant deployment
* Monitoring and observability

---

# Current Backend Structure

```text
backend/
├── prisma/
│   └── schema.prisma
├── server.js
├── .env
└── src/
    ├── config/
    │   ├── config.js
    │   └── prisma.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── health.controller.js
    │   └── organization.controller.js
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   └── notFound.middleware.js
    ├── routes/
    │   ├── index.js
    │   ├── auth.routes.js
    │   ├── health.routes.js
    │   └── organization.routes.js
    ├── services/
    │   ├── auth.services.js
    │   └── organization.service.js
    ├── utils/
    │   ├── ApiError.js
    │   ├── ApiResponse.js
    │   ├── asyncHandler.js
    │   ├── jwt.js
    │   └── password.js
    └── app.js
```

---

# Progress Summary

| Phase                             | Status      |
| --------------------------------- | ----------- |
| Backend Foundation                | ✅ Completed |
| Authentication & Identity         | ✅ Completed |
| Organization Management           | ✅ Completed |
| Organization Hierarchy            | ✅ Completed |
| Unit Management                   | ✅ Completed |
| Permission Schema Foundation      | ✅ Completed |
| Capacity Schema Foundation        | ✅ Completed |
| Invitation Schema Foundation      | ✅ Completed |
| Permission Engine                 | ⏳ Next      |
| Capacity Management               | ⏳ Planned   |
| Invitation Management             | ⏳ Planned   |
| Member Management                 | ⏳ Planned   |
| Unit Reorganization               | ⏳ Planned   |
| Document Management               | ⏳ Planned   |
| Document Processing               | ⏳ Planned   |
| Vector & Retrieval Infrastructure | ⏳ Planned   |
| RAG Pipeline                      | ⏳ Planned   |
| Reliability & Caching             | ⏳ Planned   |
| Evaluation & Monitoring           | ⏳ Planned   |
| Deployment                        | ⏳ Planned   |
