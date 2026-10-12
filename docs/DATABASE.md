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

**DocumentAccessAudit** — append-only history; every access mutation writes an audit record in the same transaction. Events emitted by code: `CREATED` (policy grant and publish-time seeding), `UPDATED` (policy update), `REVOKED` (policy revocation). Events defined in the schema but **not yet emitted** by any code path: `EXPIRED`, `TEMPORARY_GRANTED`, `TEMPORARY_EXTENDED`. `grantTemporaryDocumentAccess` delegates to `grantDocumentAccess` and records a `CREATED` event, not a `TEMPORARY_GRANTED` event.

## S3 Storage Model

```text
Draft:     organizations/{organizationId}/drafts/{documentId}/{versionId}
Published: organizations/{organizationId}/documents/{documentId}/{versionId}
```

The bucket stays private; PostgreSQL stores object references, not public URLs; authorized downloads use short-lived presigned URLs.

## Version-Aware Retrieval Caching

Two Redis caches, both tenant-scoped to the user's organization, with distinct keying strategies and different authorization guarantees:

- **Query cache** (`rag:retrieval:{orgId}:{topK}:{queryHash}`, 300 s TTL) — stores the AI service's **raw candidate list**. Keyed by organization + query + topK only; it is **not** user- or access-scope-scoped. A cache hit is candidate evidence, never authorized content. The backend always re-runs `authorizeQueryDocuments` (database policy evaluation) against the cached candidates before any of their text reaches a model.
- **Authorized retrieval cache** (`rag:authorized-retrieval:{orgId}:{scopeHash}:{topK}:{queryHash}`, 300 s TTL) — stores the **backend-authorized candidate set** keyed by organization + the user's **access-scope fingerprint** + query + topK. On a hit, the stored candidates are re-validated against `Document.currentVersionId` by `validateCurrentCandidates` before reuse; stale versions are excluded and trigger a fresh authorization pass.

Cache invalidation:

- Any access-policy grant, update, or revoke calls `invalidateOrganizationAuthorizedQueryCache(organizationId)`, which SCAN-deletes the entire `rag:authorized-retrieval:{orgId}:*` namespace. Verified in `documentAccess.service.js` (`grantDocumentAccess`, `updateDocumentAccessPolicy`, `revokeDocumentAccess`).
- The access-scope fingerprint (`getQueryAccessScopeFingerprint`) is a SHA-256 over the user's organization ID, unit ID, role, sorted unit hierarchy, and the sorted set of matched `QUERY` policies (including `id`, `documentId`, subject fields, `effect`, `scope`, `validFrom`, `validUntil`, and `updatedAt`). It is recomputed per request and used as the authorized-cache key component so that a cache hit is only served when the current request's fingerprint matches the stored entry. **Verified:** the fingerprint captures the matched `QUERY` policies and the user's scope at computation time, and `updatedAt` is included so a policy update changes the fingerprint; the authorized cache is invalidated on every policy mutation. **Not yet verified against live infrastructure:** that expiry, revocation, and invalidation behavior keep the cache authorization-safe under concurrent policy changes, or that the fingerprint is collision-resistant at scale.
- Successful document processing calls `invalidateOrganizationQueryCache(organizationId)`, which SCAN-deletes the entire `rag:retrieval:{orgId}:*` namespace so stale candidate lists are replaced.

**The raw query cache is intentionally not invalidated on policy changes.** It stores pre-authorization candidates only, and authorization is re-applied on every request regardless of cache state. If authorization state cannot be verified (no organization unit, Redis disabled, or policy query failure), the request is rejected (403) or re-runs authorization — never served from cache.

Both caches return `null` on Redis errors (cache miss); the pipeline then falls through to live retrieval and authorization.

**Verified implementation:** the authorized cache key includes the access-scope fingerprint, and cached candidates are re-validated against current versions before reuse. **Unverified behavior:** no automated test exercises the Redis SCAN/DEL invalidation path or the authorized-cache fingerprint collision resistance against live Redis.

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

**Authoritative query authorization.** `authorizeQueryDocuments` (`documentAccess.service.js`) is the sole database path that decides which documents a user may query:

1. Selects `Document` rows scoped to the user's `organizationId`, where `isDeleted = false`, `status = 'READY'`, and `currentVersionId` is not null — enforcing tenant isolation, lifecycle state, and soft-deletion at the SQL level.
2. Selects all active `DocumentAccessPolicy` rows for those documents with `action = 'QUERY'`.
3. Evaluates each policy against the user via the shared `policyMatchesUser` matcher (subject-type dispatch + unit-hierarchy walk for `UNIT_AND_DESCENDANTS`).
4. Resolves with `resolvePolicyDecision`: any matching `DENY` → denied; otherwise a matching `ALLOW` → allowed; empty match set → denied.

The result is a list of `{documentId, currentVersionId}` pairs. The caller (`authorizeCandidates` in `query.service.js`) then filters candidate chunks to only those whose `document_id` is in this set **and** whose `version_id` equals the document's current version. A document ID match alone is never authorization.

### Authoritative policy evaluator

The single, shared authorization engine lives in `backend/src/services/document/documentAccess.service.js`. It is the only place where `DocumentAccessPolicy` rows are resolved against a user. Every authorization path — single-document actions (`authorizeDocumentAction`), batched listings (`authorizeDocumentsForAction`), query retrieval (`authorizeQueryDocuments`), and the access-scope fingerprint (`getQueryAccessScopeFingerprint`) — resolves through the exported helpers below. No other module contains policy-matching logic.

| Function | Role |
| --- | --- |
| `policyMatchesUser(policy, user, userUnitHierarchy)` | Shared subject matcher. Returns `true` only when the policy is active and its subject matches the user. Unknown `subjectType` values return `false` — they never grant access. |
| `evaluatePolicyMatches(policies, user, userUnitHierarchy)` | Filters a policy list to the active policies that match the user. Inactive, revoked, expired, and not-yet-valid policies are skipped before matching. |
| `resolvePolicyDecision(matches)` | Converts a match set into `allowed` or `denied`. Any matching `DENY` → `denied`; otherwise a matching `ALLOW` → `allowed`; an empty match set → `denied`. |
| `authorizeDocumentAction(user, documentId, action)` | Single-document authorization for `VIEW`, `DOWNLOAD`, and `MANAGE_ACCESS` checks on document read paths. |
| `authorizeDocumentsForAction(user, documentIds, action)` | Batched authorization for listing endpoints. Two queries total; returns a `Map` of `documentId → boolean`. |
| `authorizeQueryDocuments(user, documentIds)` | Query-retrieval authorization. Returns `[{documentId, currentVersionId}]` pairs for documents the user may query. |
| `getQueryAccessScopeFingerprint(user)` | SHA-256 over the user's organization, unit, role, unit hierarchy, and matched `QUERY` policies. Used as the authorized-cache key component. |

**Authorization rules enforced by the evaluator:**

- The backend owns authorization decisions. PostgreSQL is the source of truth for document access policies.
- DENY overrides ALLOW. No matching applicable ALLOW means denied.
- Inactive, revoked, expired, and not-yet-valid policies must not grant access.
- Organization boundaries and supported user, role, and organizational-unit scopes must be enforced.
- Unknown policy subject types must not accidentally grant access.
- Single-document and batch authorization must apply consistent decision semantics.

**Critical RAG security invariant:** unauthorized content must never reach the LLM. Retrieved chunks are candidates, not authorized evidence. Every candidate must pass document identity validation, version-freshness verification, and backend authorization before its text can reach a model. Qdrant retrieval scores, AI-service payload metadata, and cached content cannot grant access.

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
- `DocumentAccessAudit.eventType` defines `EXPIRED`, `TEMPORARY_GRANTED`, and `TEMPORARY_EXTENDED` but no code path emits them — temporary grants produce a `CREATED` event and expiry is not tracked.
- Cleanup ordering is conventional, not schema-enforced.
- No `processingError` column — versions record *that* they failed, not *why*.
- Revocation is represented twice (`isActive` + `revokedAt`); both are kept in agreement, but a future path could set one without the other.
- `MANAGE_ACCESS` provisioning is per-document; no tenant-wide default (`documentId` is `NOT NULL`).
- `QueryHistory` has no retention policy and grows without bound.
