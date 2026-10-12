# RAG Database Architecture

Database design for the Enterprise RAG Platform.

Prisma schema: `backend/prisma/schema.prisma` · Backend implementation: `docs/DEVELOPMENT.md`

## Storage Responsibilities

| Store | Holds |
| --- | --- |
| PostgreSQL | Application and authorization source of truth |
| Amazon S3 | Draft and versioned document files |
| Qdrant | Embeddings and retrieval metadata |
| Redis | Background jobs and caching |

Large files and vectors are not stored in PostgreSQL.

**Core security rule:** PostgreSQL is the authorization authority, Qdrant is retrieval infrastructure. Unauthorized content must never reach the LLM.

## Schema Overview

**Organization & identity**

| Model | Purpose |
| --- | --- |
| `Organization` | Tenant root with revision counter for multi-user sync |
| `OrganizationUnit` | Hierarchy node (`COMPANY → DEPARTMENT → TEAM → GROUP`) |
| `User` | Account, role, unit membership |
| `PermissionGrant` | Scoped administrative permissions with delegation |
| `Invitation` | Member onboarding with secure tokens |

Administrative authority = `Permission + Hierarchy Scope + Delegation Authority`. Roles classify members; permissions control administrative operations.

```text
Administrative Permission ≠ Document Access
Data Classification       ≠ Document Access
```

`User.email` is the account identity key — `CITEXT` with a unique constraint, so uniqueness and equality are case-insensitive at the database level (migration `20261005101500_normalize_user_email`). `Invitation.email` stays `TEXT`; it is not an identity column.

**Document management** (migration `20260710095413_add_document_management`)

```text
Organization
└── Document
    ├── DocumentVersion (immutable, one current)
    ├── DocumentAccessPolicy
    └── DocumentAccessAudit
```

**Query history** (migration `20260927135626_add_query_history`): per-user query/answer log with `query`, `answer`, `sources`, `evidence`, `usedLLM`, `outputGuardPassed`. Indexed on `organizationId`, `userId`, `createdAt`. The API never exposes `organizationId` or `userId`.

## Document Lifecycle

```text
DRAFT → SUBMITTED → QUEUED → PROCESSING → READY
  │                                         │
  └→ EXPIRED (24 h)              new version → QUEUED
                                   soft delete → DELETED
                                                   ├→ restore → READY (version processed)
                                                   │          or FAILED (not processed)
                                                   └→ permanent cleanup
```

Allowed transitions (single authoritative table in `backend/src/services/document/documentHelpers.js`):

| From | To |
| --- | --- |
| DRAFT | SUBMITTED, EXPIRED |
| SUBMITTED | PROCESSING, FAILED, DELETED |
| QUEUED | PROCESSING, FAILED, DELETED |
| PROCESSING | READY, FAILED, DELETED |
| READY | QUEUED, DELETED |
| FAILED | QUEUED, PROCESSING, DELETED |
| DELETED | READY, FAILED |
| EXPIRED | — (terminal) |

| State | Meaning |
| --- | --- |
| `DRAFT` | Staging; max 24 hours before expiry |
| `SUBMITTED` | Awaiting dispatch; transient — stranded publications are re-dispatched at startup |
| `QUEUED` | Processing job prepared |
| `PROCESSING` | Extraction, chunking, embedding in progress |
| `READY` | Available for authorized retrieval and download |
| `FAILED` | Processing failed; recoverable via reprocess or worker retry |
| `EXPIRED` | Unpublished draft exceeded staging; access blocked (404) |
| `DELETED` | Soft-deleted; restore or physical cleanup |

Version-level state (`DocumentVersion.processingStatus`): `PENDING → QUEUED → PROCESSING → COMPLETED | FAILED`. `READY` is only entered when the current version's `processingStatus` is `READY`, so an unprocessed version can never enter the retrieval path.

## Core Document Models

**Document** — tenant ownership, metadata, classification (`GENERAL`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`), lifecycle status, current version, draft expiry, soft deletion. The file itself lives in S3.

**DocumentVersion** — one immutable version per upload; owns its S3 object, checksum, and processing state. Access is document-level; versions inherit document access.

**DocumentAccessPolicy** — current authorization state. A policy is active when `isActive = true`, `revokedAt = null`, and now is within `validFrom`/`validUntil`. Enforcement never depends on cleanup jobs.

**DocumentAccessAudit** — append-only history; every access mutation writes an audit record in the same transaction. Events: `CREATED`, `UPDATED`, `REVOKED`, `EXPIRED`, `TEMPORARY_GRANTED`, `TEMPORARY_EXTENDED`.

## S3 Storage Model

```text
Draft:     organizations/{organizationId}/drafts/{documentId}/{versionId}
Published: organizations/{organizationId}/documents/{documentId}/{versionId}
```

The bucket stays private; PostgreSQL stores object references, not public URLs; authorized downloads use short-lived presigned URLs.

## Version-Aware Retrieval Caching

Two Redis caches, tenant-scoped, keyed by organization + query + access-scope fingerprint:

- **Query cache** — final answers.
- **Authorized retrieval cache** — authorized candidate sets.

Cached candidates are validated against each document's `currentVersionId` before use; stale candidates are excluded and trigger fresh retrieval. Both caches are invalidated after successful processing and after any access-policy mutation.

## Document Access & Authorization

| Concept | Values |
| --- | --- |
| Subjects | `ORGANIZATION`, `UNIT`, `ROLE`, `USER` |
| Actions | `QUERY` (retrieval), `VIEW` (metadata), `DOWNLOAD` (file), `MANAGE_ACCESS` (policy changes) |
| Effects | `ALLOW`, `DENY` |
| Unit scope | `UNIT_ONLY`, `UNIT_AND_DESCENDANTS` |

Actions are evaluated independently. Resolution per action:

```text
Any matching DENY           → DENY
No DENY + matching ALLOW    → ALLOW
No matching policy          → DENY
```

Explicit DENY always wins; there is no specificity precedence. For RAG, a denied `QUERY` excludes the document from retrieval entirely. Temporary access uses `validFrom`/`validUntil` (max 7 days) and is rejected at authorization time.

**Uniqueness invariant:** at most one active policy per `(documentId, action, effect, subjectType, subject*)`, enforced by the partial unique index in migration `20261012100000_unique_active_document_access_policy` (pending apply). A `P2002` violation surfaces as 409; the application-level check in `validateDocumentAccessPolicy` is advisory.

**Access mutation flow:** `Validate Authority → Validate Policy → Mutate Policy → Insert Audit → Commit`. Any failure rolls back both.

Subject field requirements: `ORGANIZATION` → `subjectOrganizationId` only; `UNIT` → `subjectUnitId` + scope; `ROLE` → `subjectRole` only; `USER` → `subjectUserId` only.

## Service Invariants

```text
Document.organizationId     → must match uploader's organization
DocumentVersion.documentId  → must belong to the target document
Document.currentVersionId   → must reference a version of the same document
DocumentAccessPolicy        → organizationId must match document organization
Policy subjects             → must belong to the document organization
DocumentAccessAudit         → organizationId must match document organization
```

## Deletion & Cleanup

```text
Delete request → mark DELETED → reject retrieval and access → queue cleanup
Draft expiry   → mark EXPIRED → reject retrieval and access → manual cleanup
Restore        → DELETED → READY (version processed) | FAILED (not processed)
```

Permanent cleanup nulls `currentVersionId`, deletes versions, policies, audit rows, S3 objects, and the document. Cleanup failure must never become a security failure: if PostgreSQL says `DELETED` or `EXPIRED`, content cannot reach the LLM even if old storage or vectors still exist. Expired drafts are cleaned via `POST /documents/cleanup/expired-drafts`.

## Migrations

Eleven migrations; the eleventh (`20261012100000_unique_active_document_access_policy`, added 2026-10-12) is **pending apply** — run `npx prisma migrate deploy`, then `npx prisma migrate status`.

| Migration | Purpose |
| --- | --- |
| `20260630025915_init_auth` | Authentication foundation |
| `20260630042656_make_user_organization_optional` | Allows a user to exist before joining an organization |
| `20260705113553_add_permission_grants` | Permission grants |
| `20260705114531_add_permissions_capacity_invitations` | Permissions, unit capacity, invitations |
| `20260705120512_add_move_unit_permission` | `MOVE_UNIT` |
| `20260709023350_add_organization_revision` | Organization revision tracking |
| `20260710095413_add_document_management` | Documents, versions, access policies, access audit |
| `20260927135626_add_query_history` | Query history |
| `20261005101500_normalize_user_email` | `citext` extension, duplicate guard, lowercase backfill, `User.email` as `CITEXT` |
| `20261005140000_seed_manage_access_role_policies` | Backfills `OWNER` and `ADMIN` `MANAGE_ACCESS` policies for published documents (idempotent `NOT EXISTS` guard) |
| `20261012100000_unique_active_document_access_policy` | Deduplicates existing active policies, then enforces uniqueness of active policies per subject/action/effect with a partial expression index |

## Schema Changes (2026-10-05)

- **Case-insensitive `User.email`** — `CREATE EXTENSION citext`, a guard that refuses (rather than guesses) if case-insensitive duplicates already exist, a lowercase backfill, and conversion of the column so the unique constraint is case-insensitive. Verified applied: all existing accounts resolve with any casing, mixed-case duplicates return 409, and raw SQL inserts are rejected by `User_email_key` directly.
- **`ROLE`-subject `MANAGE_ACCESS` policies** — publish-time seeding now creates `OWNER` and `ADMIN` role policies alongside the uploader's user policy, and the migration backfills them for every already-published document. This closed the deadlock where authority is resolved *from* `MANAGE_ACCESS` policies but only the uploader ever held one. Consequence: every `ADMIN` in a tenant can manage access on every published document — narrowing that is a policy decision (`ROLE` + `UNIT_AND_DESCENDANTS` already express it), not a schema one.

## Open Schema Risks

- The `Permission` enum has no access-management value; access administration is expressed through `ROLE` policies instead.
- Cleanup ordering is conventional, not schema-enforced.
- No `processingError` column — versions record *that* they failed, not *why*.
- Revocation is represented twice (`isActive` + `revokedAt`); both are kept in agreement, but a future path could set one without the other.
- `MANAGE_ACCESS` provisioning is per-document; no tenant-wide default (`documentId` is `NOT NULL`).
- `QueryHistory` has no retention policy and grows without bound.
