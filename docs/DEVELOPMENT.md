# RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend. Database schema: [`docs/DATABASE.md`](DATABASE.md).

---

# Phase 1 — Backend Foundation ✅

## Completed

| Area | Details |
| --- | --- |
| Environment | `.env`, configuration, Neon `DATABASE_URL`, JWT settings |
| Database | Prisma setup, schema, generated client |
| Express | Application setup, CORS, JSON parsing, database connection |
| Routing | Versioned `/api/v1`, centralized router, health endpoint |
| Middleware | Global error and 404 handlers |
| Utilities | `ApiResponse`, `ApiError`, `asyncHandler` |

## Health Endpoint

```http
GET /api/v1/health
```

---

# Phase 2 — Authentication & Identity ✅

## Completed

| Area | Details |
| --- | --- |
| Schema | `Organization`, `OrganizationUnit`, `User`, `Role`, `OrganizationUnitType` |
| Registration | New users can create accounts |
| Login | Registered users can authenticate |
| Current User | Authenticated user details can be retrieved |
| Password Security | Password hashing and verification implemented |
| JWT | Token generation and verification implemented |
| Authentication Middleware | Protected routes validate JWT and load the current user |
| User Validation | Missing and inactive users are rejected |
| Design | Authentication remains independent of organization membership |

## Endpoints

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

## Authentication Flow

```text
Register
    ↓
User Created
    ↓
Login
    ↓
Generate JWT
    ↓
Protected Request
    ↓
Verify JWT
    ↓
Load User
```

Users initially have:

```text
role   = null
unitId = null
```

Organization membership is invitation-based. Users cannot assign their own role or organization unit.

---

# Phase 3 — Organization Setup ⏳

## Completed

| Area | Details |
| --- | --- |
| Architecture | Organization service, controller, routes, and centralized route registration |
| Security | JWT protection and organization membership validation |
| Organization Creation | Organization created through a Prisma transaction |
| Root Unit | Root `COMPANY` unit created automatically |
| Owner Assignment | Organization creator assigned `OWNER` role and root unit |
| Organization Details | Authenticated members can retrieve organization details |
| Organization Update | `OWNER` and `ADMIN` can update organization details |
| Unit Retrieval | All organization units can be retrieved |
| Department Creation | Departments can be created under the root `COMPANY` unit |
| Team Creation | Teams can be created under departments |
| Group Creation | Groups can be created under teams |
| Hierarchy Validation | Invalid parent-child relationships are rejected |
| Organization Isolation | Cross-organization parent assignment is prevented |
| Role Validation | Unit management restricted to `OWNER` and `ADMIN` |
| Unit Update | Departments, teams, and groups can be renamed |
| Unit Deletion | Organization units can be deleted |
| Company Protection | Root `COMPANY` unit cannot be deleted |
| Child Constraints | Units containing child units cannot be deleted |
| Member Constraints | Units containing assigned users cannot be deleted |

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

## Organization Creation Flow

```text
Authenticated User
        ↓
Validate User
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

## Organization Management Flow

```text
Authenticated User
        ↓
Validate Membership
        ↓
Validate OWNER / ADMIN
        ↓
Retrieve / Update Organization
```

## Unit Creation Flow

```text
Authenticated User
        ↓
Validate Membership
        ↓
Validate OWNER / ADMIN
        ↓
Validate Parent Unit
        ↓
Validate Organization Ownership
        ↓
Validate Hierarchy
        ↓
Create Unit
```

## Unit Update Flow

```text
Authenticated User
        ↓
Validate Membership
        ↓
Validate OWNER / ADMIN
        ↓
Validate Unit Exists
        ↓
Validate Organization Ownership
        ↓
Update Unit Name
```

## Unit Deletion Flow

```text
Authenticated User
        ↓
Validate Membership
        ↓
Validate OWNER / ADMIN
        ↓
Validate Unit Exists
        ↓
Validate Organization Ownership
        ↓
Reject COMPANY Deletion
        ↓
Check Child Units
        ↓
Check Assigned Members
        ↓
Delete Unit
```

## Organization Hierarchy

```text
COMPANY
   ↓
DEPARTMENT
   ↓
TEAM
   ↓
GROUP
```

Valid relationships:

```text
COMPANY    → DEPARTMENT
DEPARTMENT → TEAM
TEAM       → GROUP
```

Invalid relationships are rejected by the service layer.

Examples:

```text
COMPANY    → TEAM         ❌
COMPANY    → GROUP        ❌
DEPARTMENT → GROUP        ❌
TEAM       → DEPARTMENT   ❌
GROUP      → Any Unit     ❌
```

## Unit Deletion Constraints

```text
COMPANY       → Cannot Delete
Has Children  → Cannot Delete
Has Members   → Cannot Delete
Leaf Unit     → Can Delete
```

The deletion service explicitly validates these constraints before calling Prisma delete operations. This prevents accidental hierarchy deletion through cascading database relationships.

## Remaining

### Member Management

- Invite members
- Accept invitations
- Assign organization units and roles
- Update member roles
- Move members between organization units
- Remove members
- Permission management

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

**Current Phase:** Phase 3 — Organization Setup ⏳

| Backend Phase | Status |
| --- | --- |
| Backend Foundation | ✅ Completed |
| Authentication & Identity | ✅ Completed |
| Organization Creation | ✅ Completed |
| Organization Details & Update | ✅ Completed |
| Unit Retrieval | ✅ Completed |
| Department Creation | ✅ Completed |
| Team Creation | ✅ Completed |
| Group Creation | ✅ Completed |
| Hierarchy Validation | ✅ Completed |
| Organization Isolation | ✅ Completed |
| Unit Update | ✅ Completed |
| Unit Deletion | ✅ Completed |
| Deletion Constraints | ✅ Completed |
| Member Management | ⏳ Next |
| Document Management | ⏳ Planned |
| Document Processing | ⏳ Planned |
| Vector Database | ⏳ Planned |
| Retrieval Pipeline | ⏳ Planned |
| LLM Integration | ⏳ Planned |
| Query Caching | ⏳ Planned |
| Evaluation | ⏳ Planned |
| Monitoring | ⏳ Planned |
| Deployment | ⏳ Planned |