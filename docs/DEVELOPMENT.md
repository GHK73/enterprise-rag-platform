# RAG Development Log

Implementation progress for the Enterprise RAG Platform. Database details: [`docs/DATABASE.md`](DATABASE.md).

---

# Phase 1 — Backend Foundation ✅

## Structure

```text
backend/
├── prisma/
├── server.js
├── .env
└── src/
    ├── config/          config.js, prisma.js
    ├── controllers/     health.controller.js
    ├── middleware/      error.middleware.js, notFound.middleware.js
    ├── routes/          index.js, health.routes.js
    ├── services/
    ├── utils/           ApiResponse.js, ApiError.js, asyncHandler.js
    └── app.js
```

## Completed

| Area | Details |
| ---- | ------- |
| Environment | `.env`, `src/config/config.js` — port, env, Neon `DATABASE_URL`, JWT config |
| Prisma | Installed, `prisma/schema.prisma`, `src/config/prisma.js`, client generated |
| Express | `src/app.js`, `server.js` — JSON + CORS, Prisma connect before listen |
| API | Versioned `/api/v1`, centralized routes, health check, global error + 404 handlers |
| Utilities | `ApiResponse`, `ApiError`, `asyncHandler` (wrapper ready, not yet wired) |

**Health:** `GET /api/v1/health` → `{ "success": true, "statusCode": 200, "message": "RAG Backend is running", "data": null }`

---

# Phase 2 — Authentication & Identity ⏳ In Progress

## Completed

| Area                   | Files / Artifacts                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Database schema        | `prisma/schema.prisma` — `Organization`, `OrganizationUnit`, `User`; enums `Role`, `OrganizationUnitType` |
| Schema documentation   | `docs/DATABASE.md` — models, relationships, authentication workflow, organization workflow                |
| Password utilities     | `src/utils/password.js` — password hashing and verification using bcrypt                                  |
| JWT utilities          | `src/utils/jwt.js` — JWT generation and verification                                                      |
| Authentication service | `src/services/auth.services.js` — service scaffold created                                                |

### JWT Configuration (`accessSecret` / `accessExpiry`)

Access tokens use a dedicated secret and expiry, separate from any future refresh tokens.

| Config key (`config.js`) | Env variable | Used by | Purpose |
| ------------------------ | ------------ | ------- | ------- |
| `jwt.accessSecret` | `JWT_ACCESS_SECRET` | `generateToken` | Signs access tokens |
| `jwt.accessExpiry` | `JWT_ACCESS_EXPIRES_IN` | `generateToken` | Access token lifetime (e.g. `15m`, `1h`) |
| `jwt.secret` | `JWT_SECRET` | `verifyToken` | Verifies incoming access tokens |

**Token payload** (`src/utils/jwt.js`): `userId`, `role`, `unitId`.

**Status:** `jwt.js` expects `accessSecret` and `accessExpiry`; `config.js` still maps only `JWT_SECRET` / `JWT_EXPIRES_IN`. Align `config.js` and `.env` before login endpoints ship. After alignment, `verifyToken` should use `accessSecret` (same key as signing).

**Planned (not implemented):** `jwt.refreshSecret` / `jwt.refreshExpiry` from `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` for refresh tokens.

### Authentication Architecture

The platform separates **authentication**, **organization management**, and **member management**.

```
Authentication
├── Register
├── Login
└── JWT Authentication

Organization
├── Create Organization
├── Organization Hierarchy
└── Organization Settings

Member Management
├── Invite Members
├── Assign Roles
├── Assign Organization Units
└── Permission Management
```

### Current Design Decisions

* Users can register without belonging to an organization.
* `role` is optional until a user becomes part of an organization.
* `unitId` is optional until a user is assigned to an organization unit.
* Creating an organization is **not** part of user registration.
* Organization membership will be handled by a dedicated member management module.
* Users will join organizations through invitations in a future phase.

## Remaining

### Authentication

* Register endpoint
* Login endpoint
* JWT authentication middleware
* Protected route middleware

### Organization

* Create organization
* Create root organization unit
* Assign organization owner

### Member Management

* Invite members
* Accept invitations
* Assign organization units
* Role assignment
* Permission management


---

# Progress Summary

**Current phase:** Phase 2 — Authentication & RBAC ⏳

| Phase | Status |
| ----- | ------ |
| Backend Foundation | ✅ Completed |
| Authentication & RBAC | ⏳ In Progress |
| Document Management | ⏳ Planned |
| Document Processing Pipeline | ⏳ Planned |
| Vector Database Integration | ⏳ Planned |
| Retrieval Pipeline | ⏳ Planned |
| LLM Integration | ⏳ Planned |
| Query Caching | ⏳ Planned |
| Evaluation Framework | ⏳ Planned |
| Monitoring & Logging | ⏳ Planned |
| Deployment | ⏳ Planned |
