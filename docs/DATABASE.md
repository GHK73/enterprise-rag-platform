# RAG Database Architecture

Database design for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

**Current phase:** Phase 5 schema complete — Phase 6 processing models planned

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

---

# Document Lifecycle

```text
DRAFT → SUBMITTED → QUEUED → PROCESSING → READY
DRAFT → EXPIRED
PROCESSING → FAILED
READY → DELETED (soft delete; access blocked immediately)
```

| State | Meaning |
| --- | --- |
| `DRAFT` | Staging; max 24 hours before expiry |
| `SUBMITTED` | Configuration validated, awaiting processing |
| `QUEUED` | Processing job prepared |
| `PROCESSING` | Extraction, chunking, embedding in progress |
| `READY` | Available for authorized retrieval and download |
| `FAILED` | Processing failed; may be retried |
| `EXPIRED` | Unpublished draft exceeded staging period |
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
```

Asynchronous cleanup may remove S3 objects, Qdrant vectors, and cached data. Cleanup failure must never become a security failure — if PostgreSQL says `DELETED`, content cannot reach the LLM even if old storage or vectors still exist.

---

# Future Schema (Not Yet Implemented)

## Phase 6 — Document Processing

```text
DocumentVersion → Page → ContentBlock → Chunk
```

Content types planned: `TEXT`, `TABLE`, `IMAGE`, `CHART`, `DIAGRAM`

## Phase 7 — Retrieval Infrastructure

Qdrant points will carry ownership identifiers (`organizationId`, `documentId`, `documentVersionId`, etc.). Access lists will not be the primary authorization source inside Qdrant — PostgreSQL remains the authority; retrieval revalidates before content reaches the LLM.

Long-term vector multitenancy may add `OrganizationVectorPlacement` for shard routing. Not in the current schema.

---

# Database Status

| Item | Status |
| --- | --- |
| Auth & organization models | ✅ |
| Permission grants & invitations | ✅ |
| Organization revision | ✅ |
| Document enums and models | ✅ |
| Referential integrity review | ✅ |
| Prisma validation | ✅ |
| Migration applied | ✅ |

Migrations:

```text
20260630025915_init_auth
20260630042656_make_user_organization_optional
20260705113553_add_permission_grants
20260705114531_add_permissions_capacity_invitations
20260705120512_add_move_unit_permission
20260709023350_add_organization_revision
20260710095413_add_document_management
```
