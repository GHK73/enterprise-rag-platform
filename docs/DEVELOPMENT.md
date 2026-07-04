# RAG Development Log

Implementation progress for the Enterprise RAG Platform. Database schema: [`docs/DATABASE.md`](DATABASE.md).

---

# Phase 1 — Backend Foundation ✅

## Completed

| Area | Details |
| --- | --- |
| Environment | `.env`, configuration, Neon `DATABASE_URL`, JWT settings |
| Database | Prisma setup, schema, generated client |
| Express | App, CORS, JSON parsing, database connection |
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
| Authentication | Registration, login, current user retrieval |
| Security | Password hashing, JWT generation and verification |
| Middleware | Protected routes, missing user and inactive account validation |
| Design | Authentication independent of organization membership |

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

Users initially have `role = null` and `unitId = null`. Organization membership is invitation-based, and users cannot assign their own role or organization unit.

---

# Phase 3 — Organization Setup ⏳

## Completed

| Area | Details |
| --- | --- |
| Architecture | Organization service, controller, routes, centralized registration |
| Security | JWT protection and organization membership validation |
| Creation | Organization created through a Prisma transaction |
| Root Unit | Root `COMPANY` unit created automatically |
| Owner Setup | Creator assigned `OWNER` role and root unit |
| Organization Details | Authenticated user can retrieve organization details |
| Organization Update | `OWNER` and `ADMIN` can update organization details |
| Unit Retrieval | Organization units can be retrieved |
| Department Creation | Departments can be created under the root `COMPANY` unit |
| Hierarchy Validation | Invalid parent-child relationships are rejected |
| Organization Isolation | Cross-organization parent assignment is prevented |
| Role Validation | Unit creation restricted to `OWNER` and `ADMIN` |
| Frontend Integration | Completed organization features tested through the frontend |

## Endpoints

```http
POST  /api/v1/organization
GET   /api/v1/organization
PATCH /api/v1/organization

GET   /api/v1/organization/units
POST  /api/v1/organization/units
```

## Organization Creation Flow

```text
Authenticated User
        ↓
Validate User and Membership
        ↓
Prisma Transaction
   ├── Create Organization
   ├── Create COMPANY Unit
   └── Assign OWNER
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
Validate Membership and Role
        ↓
Validate Parent Unit
        ↓
Validate Organization Ownership
        ↓
Validate Hierarchy
        ↓
Create Unit
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

## Remaining

### Organization Units

- Create teams and groups
- Display nested hierarchy
- Update and delete units
- Handle deletion constraints

### Member Management

- Invite and accept members
- Assign organization units and roles
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

| Phase | Status |
| --- | --- |
| Backend Foundation | ✅ Completed |
| Authentication & Identity | ✅ Completed |
| Organization Creation | ✅ Completed |
| Organization Details & Update | ✅ Completed |
| Unit Retrieval & Departments | ✅ Completed |
| Teams & Groups | ⏳ In Progress |
| Member Management | ⏳ Planned |
| Document Management | ⏳ Planned |
| Document Processing | ⏳ Planned |
| Vector Database | ⏳ Planned |
| Retrieval Pipeline | ⏳ Planned |
| LLM Integration | ⏳ Planned |
| Query Caching | ⏳ Planned |
| Evaluation | ⏳ Planned |
| Monitoring | ⏳ Planned |
| Deployment | ⏳ Planned |