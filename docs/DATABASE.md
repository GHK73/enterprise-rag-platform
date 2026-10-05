# RAG Database Architecture

Database design for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

**Current phase:** Phase 9 — Reliability & Performance (schema complete; Phase 6–8 implemented, Phase 10+ planned)

Prisma schema: `backend/prisma/schema.prisma`

---

# Storage Responsibilities

```text
PostgreSQL  → Application and authorization source of truth
Amazon S3   → Draft and versioned file storage
Qdrant      → Embeddings and retrieval metadata (vector indexing implemented; authorized retrieval pending)
Redis       → Background jobs and caching (queue implementation present; deployment verification pending)
```

Large files and vectors are not stored in PostgreSQL.

**Core security rule:**

```text
PostgreSQL → Authorization Authority
Qdrant     → Retrieval Infrastructure

Unauthorized content must never reach the LLM.
```

---

# Schema Overview

## Organization & Identity

| Model | Purpose |
| --- | --- |
| `Organization` | Tenant root with revision counter for multi-user sync |
| `OrganizationUnit` | Hierarchy node (`COMPANY → DEPARTMENT → TEAM → GROUP`) |
| `User` | Account, role, and unit membership |
| `PermissionGrant` | Scoped administrative permissions with delegation |
| `Invitation` | Member onboarding with secure tokens |

**Administrative authority:** `Permission + Hierarchy Scope + Delegation Authority`

Roles classify members. Permissions control administrative operations.

```text
Administrative Permission ≠ Document Access
Data Classification       ≠ Document Access
```

### User Email Identity

`User.email` is the account identity key and is `CITEXT` with a unique constraint, so uniqueness and equality are both case-insensitive at the database level. `registerUser` additionally stores the canonical `trim().toLowerCase()` form, which is what `loginUser` and the login rate limiter look up.

Migration: `20261005101500_normalize_user_email` — enables `citext`, guards against pre-existing case-insensitive duplicates, backfills existing rows to lowercase, and converts the column.

`Invitation.email` remains `TEXT`. It is not an identity column and is already compared case-insensitively where it matters.

## Document Management (Phase 5)

| Model | Purpose |
| --- | --- |
| `Document` | Logical document, metadata, lifecycle, current version |
| `DocumentVersion` | Immutable file version with S3 reference and processing state |
| `DocumentAccessPolicy` | Current authorization state |
| `DocumentAccessAudit` | Append-only access change history |

```text
Organization
└── Document
    ├── DocumentVersion (immutable, one current)
    ├── DocumentAccessPolicy
    └── DocumentAccessAudit
```

Migration: `20260710095413_add_document_management`

## Query History

| Model | Purpose |
| --- | --- |
| `QueryHistory` | Per-user query/answer log for analytics and offline evaluation |

Migration: `20260927135626_add_query_history`

Key fields: `organizationId`, `userId`, `query`, `answer`, `sources`, `evidence`, `usedLLM`, `outputGuardPassed`, `createdAt`

Indexed on `organizationId`, `userId`, and `createdAt`. The `organizationId` and `userId` columns are not exposed through the API response.

---

# Document Lifecycle

```text
DRAFT → SUBMITTED → QUEUED → PROCESSING → READY
DRAFT → EXPIRED
PROCESSING → FAILED
READY → QUEUED
READY → DELETED (soft delete; access blocked immediately)
```

`READY → QUEUED` occurs when a new version is uploaded; it creates a new immutable `DocumentVersion` and invalidates any cached retrieval results for the tenant.

| State | Meaning |
| --- | --- |
| `DRAFT` | Staging; max 24 hours before expiry |
| `SUBMITTED` | Configuration validated, awaiting processing |
| `QUEUED` | Processing job prepared |
| `PROCESSING` | Extraction, chunking, embedding in progress |
| `READY` | Available for authorized retrieval and download |
| `FAILED` | Processing failed; may be retried |
| `EXPIRED` | Unpublished draft exceeded staging period; access blocked (404) |
| `DELETED` | Soft-deleted; physical cleanup is asynchronous |

Version-level processing state (`DocumentVersion.processingStatus`): `PENDING → QUEUED → PROCESSING → COMPLETED | FAILED`

---

# Core Document Models

## Document

Tenant ownership, metadata, classification, lifecycle state, current version reference, draft expiry, and soft deletion. The file itself lives in S3.

Key fields: `organizationId`, `title`, `description`, `classification`, `status`, `currentVersionId`, `uploadedById`, `draftExpiresAt`, `submittedAt`, `isDeleted`, `deletedAt`, `deletedById`

## DocumentVersion

One immutable application-level version per upload. Each version owns its S3 object, checksum, and processing state. Access is document-level; versions inherit document access.

Key fields: `documentId`, `versionNumber`, `storageBucket`, `storageKey`, `originalFileName`, `mimeType`, `fileSize`, `checksum`, `processingStatus`, `createdById`

```text
DocumentVersion → Business and retrieval history
S3 Versioning   → Storage recovery (separate concern)
```

## DocumentAccessPolicy

Current authorization state for a document.

Key fields: `subjectType`, subject IDs (`subjectOrganizationId`, `subjectUnitId`, `subjectRole`, `subjectUserId`), `action`, `effect` (`ALLOW` / `DENY`), `scope` (`UNIT_ONLY` / `UNIT_AND_DESCENDANTS`), `validFrom`, `validUntil`, `isActive`, `revokedAt`

A policy is active when:

```text
isActive = true AND revokedAt = null
AND validFrom <= now
AND (validUntil = null OR validUntil > now)
```

Security enforcement does not depend on cleanup jobs.

## DocumentAccessAudit

Append-only history. Every access mutation must create an audit record in the same transaction.

Event types: `CREATED`, `UPDATED`, `REVOKED`, `EXPIRED`, `TEMPORARY_GRANTED`, `TEMPORARY_EXTENDED`

---

# S3 Storage Model

Implemented key patterns:

```text
Draft:
organizations/{organizationId}/drafts/{documentId}/{versionId}

Published:
organizations/{organizationId}/documents/{documentId}/{versionId}
```

Rules:

* Bucket remains private
* PostgreSQL stores object references, not permanent public URLs
* Authorized downloads use short-lived presigned URLs

Future artifact paths (Phase 6) may add extracted content under version keys.

---

# Version-Aware Retrieval Caching

Redis caches retrieval candidates keyed by organization ID, requested `topK`, and a SHA-256 hash of the query text. Cached candidates are validated against each document's `currentVersionId` before use; stale candidates (from a superseded version) are excluded and trigger a fresh AI service retrieval.

Cache invalidation happens automatically after successful document processing. The cache is tenant-scoped — an organization's cache is never shared or readable by another tenant.

---

# Classification

Enums: `GENERAL`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`

Classification describes data sensitivity, not user authority. A senior role does not automatically grant access to sensitive documents — that is controlled by `DocumentAccessPolicy`.

---

# Document Access & Authorization

**Subjects:** `ORGANIZATION`, `UNIT`, `ROLE`, `USER`

**Actions:**

| Action | Purpose |
| --- | --- |
| `QUERY` | Content may participate in retrieval |
| `VIEW` | Metadata and details |
| `DOWNLOAD` | Original file access |
| `MANAGE_ACCESS` | Access-policy changes |

Actions are evaluated independently.

**Resolution (per action):**

```text
Any matching DENY           → DENY
No DENY + matching ALLOW    → ALLOW
No matching policy          → DENY
```

Explicit `DENY` always wins. There is no specificity precedence (`USER > UNIT > ROLE > ORGANIZATION`).

For RAG: if `QUERY` is denied, the document is excluded from retrieval and cannot reach the LLM.

**Temporary access:** uses `validFrom` / `validUntil` (max 7 days). Expired access is rejected at authorization time, before housekeeping.

**Access mutation flow:**

```text
Validate Authority → Validate Policy → Mutate Policy → Insert Audit → Commit
```

Any failure rolls back both the policy mutation and audit insertion.

---

# Service Invariants

All document mutations must validate tenant consistency.

```text
Document.organizationId        → Must match uploader's organization
DocumentVersion.documentId     → Must belong to target document
Document.currentVersionId      → Must reference a version of the same document
DocumentAccessPolicy           → organizationId must match document organization
Policy subjects                → Must belong to document organization
DocumentAccessAudit            → organizationId must match document organization
```

Subject field requirements:

```text
ORGANIZATION → subjectOrganizationId only; scope null
UNIT         → subjectUnitId required; scope required
ROLE         → subjectRole required; scope null
USER         → subjectUserId required; scope null
```

Foreign keys enforce direct relations. Cross-organization and polymorphic subject rules are additionally enforced in the service layer.

---

# Deletion & Cleanup

Access is blocked before physical cleanup:

```text
Delete Request → Mark DELETED → Reject retrieval and access → Queue cleanup
Draft Expiry  → Mark EXPIRED → Reject retrieval and access → Manual cleanup
```

Asynchronous cleanup may remove S3 objects, Qdrant vectors, and cached data. Cleanup failure must never become a security failure — if PostgreSQL says `DELETED` or `EXPIRED`, content cannot reach the LLM even if old storage or vectors still exist.

EXPIRED drafts can be physically cleaned up via `POST /documents/cleanup/expired-drafts` (see `cleanupExpiredDrafts` in the backend).

---

# Future Schema (Not Yet Implemented)

## Phase 6 — Document Processing (Implemented in AI Service)

Processing models (`Page`, `ContentBlock`, `Chunk`) live in the AI service, not in the Prisma schema. Content types handled: `TEXT`, `TABLE`, `IMAGE`, `CHART`, `DIAGRAM`.

## Phase 7 — Retrieval Infrastructure (Implemented)

Qdrant points carry ownership identifiers (`organizationId`, `documentId`, `documentVersionId`). PostgreSQL remains the authorization authority; the backend revalidates access before content reaches the LLM.

Long-term vector multitenancy may add `OrganizationVectorPlacement` for shard routing. Not in the current schema.

---

## Schema Risks

Identified during the 2026-09-30 code audit. These are schema-level constraints and modelling gaps.
Code-level defects, with file and line references, are in `docs/DEVELOPMENT.md`. Items marked FIXED or
MITIGATED were addressed on the date shown; the underlying modelling gap is noted where it remains.

## `Permission` Has No Access-Management Value — MITIGATED 2026-10-05

The `Permission` enum contains only `INVITE_MEMBER`, `REMOVE_MEMBER`, `UPDATE_MEMBER`, `ASSIGN_ROLE`, `MOVE_MEMBER`, `CREATE_UNIT`, `UPDATE_UNIT`, `DELETE_UNIT`, and `MOVE_UNIT`. There is no administrative permission meaning "may change document access policies".

The service layer previously checked `hasPermission(user.id, "MANAGE_ACCESS", …)`, which is a
`DocumentAccessAction` and not a `Permission`, so every grant, update, and revoke raised a Prisma
enum validation error and returned 500. Authority is now resolved from `DocumentAccessPolicy` rows,
which is the correct source.

The underlying schema gap remains: the enum still has no access-management value, so access
administration cannot be delegated through the `PermissionGrant` mechanism the way membership
administration can. It is now expressed through `ROLE`-subject policies instead — see Schema Changes
2026-10-05. Adding a `MANAGE_DOCUMENT_ACCESS` permission plus a grant path would make access
administration assignable the same way `ASSIGN_ROLE` is, and is the cleaner long-term model.

## `Document.currentVersionId` Is `ON DELETE RESTRICT` — FIXED 2026-10-05

```text
Document.currentVersion → DocumentVersion  (onDelete: Restrict)
```

Any bulk delete of `DocumentVersion` rows while `Document.currentVersionId` still points at one of
them fails with a foreign-key violation. Deleting a document therefore requires nulling
`currentVersionId` first, then deleting versions, then deleting the document.

`cleanupDraftUpload`, `cleanupDeletedDocument`, and `cleanupExpiredDrafts` now all follow that
ordering. Verified against the development database in rolled-back transactions: the old order fails
with `violates RESTRICT setting of foreign key constraint "Document_currentVersionId_fkey"`, the
corrected order completes. Before the fix, 6 soft-deleted documents and 1 expired draft were
permanently stuck because of this.

The ordering constraint is still not expressed in the schema and remains easy to reintroduce. A
partial index or a database-level cascade would make it structural rather than conventional.

## Version-Level Processing State Is Now Written — FIXED 2026-10-04

`DocumentVersion.processingStatus` (`PENDING → QUEUED → PROCESSING → COMPLETED | FAILED`) was never
updated by any code path, so every version stayed `PENDING` for its entire lifetime. A version-level
`FAILED` could not be distinguished from a version still waiting to be processed.

`processDocument` now writes the column at each transition. A version-level `FAILED` is only written
inside the same transaction as the guarded document update, and only when that update matched exactly
one row, so a stale or duplicate job cannot mark a version that the worker does not own.

There is still no `processingError` column, so a version records *that* it failed but never *why*. A
persisted failure reason is still needed for the UI.

## Revocation Is Represented Twice — FIXED 2026-10-04

`PermissionGrant` has both `isActive` and `revokedAt`. Revocation writes `revokedAt` and left
`isActive: true`, while the permission check filtered on `isActive` only, so a re-invited member
regained every permission they had before removal.

`hasPermission` and `getUserPermissions` now filter on `revokedAt: null`, and `removeMember` sets
`isActive: false` alongside `revokedAt`. Both fields now agree after a revocation.

Keeping two representations of the same fact remains a modelling risk: the next code path that sets
one without the other reintroduces the drift.

## `MANAGE_ACCESS` Provisioning Is Per-Document, Not Tenant-Wide

`DocumentAccessPolicy.documentId` is `NOT NULL`, so no policy can exist without naming a document. A
tenant-wide or organization-wide `MANAGE_ACCESS` policy is therefore not expressible.

Authority for access management is resolved from `MANAGE_ACCESS` policies on the target document, so
the first delegation of that authority is gated on a grant of the authority being delegated. Before
2026-10-05 the only producer was the publish-time seeding of a single `USER`-subject policy for the
uploader, which made access management a single-owner feature with no bootstrap path.

The current mitigation is per-document `ROLE`-subject policies for `OWNER` and `ADMIN`. That closes
the deadlock but does not change the underlying constraint: there is no tenant-level default, and no
way to express "all documents in this organization" other than writing a policy per document. Making
`documentId` nullable, with a documented meaning for a NULL value, would allow a real tenant-level
default.

## `QueryHistory` Has No Retention Policy

Every executed query is persisted, including evidence-insufficient fallbacks and blocked outputs. The table grows without bound and no cleanup job exists, even though background cleanup is listed as implemented in Phase 9. It also stores `sources` and `evidence` inline, so it duplicates content already held in S3 and Qdrant.

---

# Database Status

| Item | Status |
| --- | --- |
| Auth & organization models | ✅ |
| Permission grants & invitations | ✅ |
| Organization revision | ✅ |
| Document enums and models | ✅ |
| Query history model | ✅ |
| Referential integrity review | ✅ |
| Prisma validation | ✅ |
| Migration applied | ✅ |
| Case-insensitive `User.email` | ✅ |
| Role-subject `MANAGE_ACCESS` provisioning | ✅ |

Schema-level risks identified during the 2026-09-30 audit are listed under Schema Risks above. Code-level defects, and the file and line references for both, are in `docs/DEVELOPMENT.md`.

---

# Migrations

Ten migrations are applied to the development database, confirmed with `npx prisma migrate status`.

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
| `20261005140000_seed_manage_access_role_policies` | Backfills `OWNER` and `ADMIN` `MANAGE_ACCESS` policies for published documents |

---

# Schema Changes (2026-10-05)

## Case-Insensitive User Email

`User.email` is now `String @unique @db.Citext`. Before this, `registerUser` stored and checked the raw
input while `loginUser` looked up `email.trim().toLowerCase()`, so a user who registered as
`User@Email.com` could never authenticate, and `Alice@Corp.com` / `alice@corp.com` created two
accounts for one person.

### Migration `20261005101500_normalize_user_email`

1. `CREATE EXTENSION IF NOT EXISTS citext`.
2. A guard that raises with an explanatory message if two accounts already share an address
   case-insensitively. Merging them is a judgment call that depends on which tenant and which
   documents each one owns, so the migration refuses rather than guessing.
3. Backfills existing rows to `LOWER(BTRIM("email"))`, so every current account is reachable by a
   normalized login.
4. Converts `User.email` to `CITEXT`. The existing `@unique` constraint is rebuilt on the new type
   and becomes case-insensitive, so uniqueness holds even if a caller writes an unnormalized address.

`Invitation.email` is deliberately left as `TEXT`. It is not an identity column, it is already
compared case-insensitively where it matters, and `citext` there would add an extension dependency
without adding a guarantee.

The application-level check is now advisory only — any future write path that forgets to normalize
cannot reintroduce the duplicate-account defect, because the constraint lives in the schema.

### Verification

Applied to the development database with `npx prisma migrate deploy`; the Prisma client was
regenerated afterwards. `User.email` reports as `citext` (`citext` 1.8), `User_email_key` is in place,
and all three existing accounts are intact and lowercase.

All three pre-existing accounts still resolve when logged in with an uppercase address — each returns
401 on a wrong password, which proves the lookup found the account and reached the password check
rather than failing as an unknown email. A new mixed-case registration stores lowercase and
authenticates with its original casing, a duplicate registration in another casing returns 409, and a
raw SQL insert of a mixed-case duplicate is rejected by `User_email_key` directly, independent of
application code.

Before applying, all four migration statements were run inside a transaction and rolled back,
confirming they apply cleanly and the guard passes on current data. A pre-migration backup of the
`User` table was taken. Test records were deleted; the user count is unchanged at 3.

## `ROLE`-Subject `MANAGE_ACCESS` Policies

`createInitialDocumentAccessPolicies` now creates a `ROLE`-subject ALLOW `MANAGE_ACCESS` policy for
`OWNER` and for `ADMIN`, alongside the uploader's `USER`-subject policies.

### Why this was a schema constraint, not only a code gap

`DocumentAccessPolicy.documentId` is `NOT NULL`, so a tenant-wide `MANAGE_ACCESS` policy cannot be
expressed. Combined with the fact that the only producer of a `MANAGE_ACCESS` policy was the
publish-time seeding of a single `USER`-subject policy for the uploader, this produced a deadlock:
authority is resolved *from* `MANAGE_ACCESS` policies, so the first delegation was gated on the
authority being delegated. No document could ever be access-managed by anyone but its uploader.

Making `documentId` nullable would permit a tenant-level policy, but per-document `ROLE` policies
express the same intent without a nullable-column change and without changing how the authorization
query is scoped.

### Migration `20261005140000_seed_manage_access_role_policies`

Backfills the same two policies for every already-published document (`status <> 'DRAFT'`). The
`INSERT` is guarded by `NOT EXISTS` on `(documentId, subjectRole, action, isActive)`, so it is
idempotent and re-running inserts nothing. `grantedById` is set to the document's `uploadedById`,
which satisfies the `onDelete: Restrict` foreign key to `User`.

### Verification

The migration was first executed inside a transaction that was deliberately rolled back. It inserted
18 policies across the 9 published documents (9 `OWNER` + 9 `ADMIN`), and a second execution inside
the same transaction inserted 0, confirming the `NOT EXISTS` guard. Policy count was confirmed back
at 0 after rollback.

Then applied to the development database with `npx prisma migrate deploy`:

| Measure | Before | After |
| --- | --- | --- |
| `MANAGE_ACCESS` policies | 7 (all `USER`) | 25 (7 `USER`, 18 `ROLE`) |
| Held by a non-uploader | 0 | 18 |
| Published documents with no `MANAGE_ACCESS` policy | 2 of 9 | 0 of 9 |

All 18 seeded policies are active. Document statuses covered: `READY`, `PROCESSING`, `DELETED`,
`EXPIRED`. The tenant has one `OWNER` and one `ADMIN`, so two members can now manage access on every
published document; the third is a `MEMBER` and correctly cannot.

This grants standing `MANAGE_ACCESS` to every `ADMIN` in the tenant on every document — an `ADMIN`
can now grant, edit, revoke, upload a new version, and re-dispatch processing for documents they did
not upload. Narrowing it to specific roles or units is a policy decision, not a schema one: the
`ROLE` subject and `UNIT_AND_DESCENDANTS` scope already exist and would express it without another
migration.
