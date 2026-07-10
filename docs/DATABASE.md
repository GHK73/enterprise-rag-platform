# RAG Database Architecture

Database design for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

> **Current Phase:** Phase 5 — Document Management

---

# 1. Storage Responsibilities

```text
PostgreSQL
→ Application and authorization source of truth
→ Organizations, users, permissions
→ Document metadata and versions
→ Access policies and audit history
→ Processing state

Amazon S3
→ Temporary uploads
→ Original versioned files
→ Extracted and visual artifacts

Qdrant
→ Embeddings
→ Retrieval metadata
→ Chunk references

Redis + BullMQ
→ Background jobs
→ Cleanup
→ Caching
```

Large files and vectors are not stored directly in PostgreSQL.

Core security rule:

```text
PostgreSQL → Authorization Authority
Qdrant     → Retrieval Infrastructure

Unauthorized content must never reach the LLM.
```

---

# 2. Organization and Authorization

Organization hierarchy:

```text
COMPANY → DEPARTMENT → TEAM → GROUP
```

Administrative authority:

```text
Permission
+
Hierarchy Scope
+
Delegation Authority
```

Roles classify members. Permissions control administrative operations.

```text
Administrative Permission
≠
Document Access

Data Classification
≠
Document Access
```

Document access is controlled independently through `DocumentAccessPolicy`.

---

# 3. Document Architecture

```text
Organization
└── Document
    ├── DocumentVersion
    ├── DocumentAccessPolicy
    └── DocumentAccessAudit
```

A logical document may have multiple immutable versions but only one current version.

```text
Document
├── Version 1
├── Version 2
└── Version 3 ← Current
```

Implemented Phase 5 models:

```text
Document
DocumentVersion
DocumentAccessPolicy
DocumentAccessAudit
```

---

# 4. Document Lifecycle

```text
DRAFT
→ SUBMITTED
→ QUEUED
→ PROCESSING
→ READY
```

Additional transitions:

```text
PROCESSING → FAILED
DRAFT      → EXPIRED
READY      → DELETED
```

## DRAFT

The file is temporarily stored while metadata, classification, and access are configured.

Initial configurable limit:

```text
Maximum draft period → 24 hours
```

Expired drafts are blocked and scheduled for cleanup.

## SUBMITTED

Document configuration and initial access have been validated.

## QUEUED

A processing job has been prepared.

## PROCESSING

The current version is being extracted, chunked, embedded, and indexed.

## READY

The document is available for authorized use.

## FAILED

Processing failed and may be retried.

## EXPIRED

An unpublished draft exceeded its staging period.

## DELETED

Access and retrieval are blocked immediately. Physical cleanup occurs asynchronously.

---

# 5. Document Model

`Document` represents one logical document across all versions.

```text
id
organizationId

title
description
classification
status

currentVersionId
uploadedById

draftExpiresAt
submittedAt

isDeleted
deletedAt
deletedById

createdAt
updatedAt
```

Responsibilities:

* Tenant ownership
* Metadata and classification
* Lifecycle state
* Current version reference
* Draft expiry
* Soft deletion

The actual file remains in S3.

---

# 6. Document Version Model

`DocumentVersion` represents one immutable application-level version.

```text
id
documentId
versionNumber

storageBucket
storageKey

originalFileName
mimeType
fileSize
checksum

processingStatus

createdById
createdAt
```

Each version owns its own:

```text
S3 source object
Processing state
Content hash
Future extracted artifacts
Future chunks and vectors
```

Application versioning and S3 versioning remain separate.

```text
DocumentVersion → Business and retrieval history
S3 Versioning   → Storage recovery
```

Access remains document-level. Versions inherit document access.

---

# 7. S3 Storage Model

Draft storage:

```text
organizations/
└── {organizationId}/
    └── drafts/
        └── {documentId}/
            └── original
```

Published storage:

```text
organizations/
└── {organizationId}/
    └── documents/
        └── {documentId}/
            └── versions/
                └── {versionId}/
                    ├── original
                    └── artifacts/
```

Rules:

* Bucket remains private
* PostgreSQL stores object references, not permanent public URLs
* Authorized downloads use short-lived presigned URLs

---

# 8. Data Classification

Initial classifications:

```text
GENERAL
INTERNAL
CONFIDENTIAL
RESTRICTED
```

Classification describes data sensitivity, not user authority.

```text
Role           → Administrative classification
Classification → Data sensitivity
Access Policy  → Actual document authorization
```

A senior organizational role does not automatically grant access to sensitive documents.

---

# 9. Document Access Model

Access subjects:

```text
ORGANIZATION
UNIT
ROLE
USER
```

Access actions:

```text
QUERY
VIEW
DOWNLOAD
MANAGE_ACCESS
```

Action responsibilities:

```text
QUERY         → Content may participate in retrieval
VIEW          → Document metadata and details
DOWNLOAD      → Original file access
MANAGE_ACCESS → Access-policy changes
```

Actions are evaluated independently.

---

# 10. Document Access Policy

`DocumentAccessPolicy` represents current authorization state.

```text
id
organizationId
documentId

subjectType

subjectOrganizationId
subjectUnitId
subjectRole
subjectUserId

action
effect
scope

validFrom
validUntil

grantedById

isActive
revokedAt
revokedById

createdAt
updatedAt
```

Effects:

```text
ALLOW
DENY
```

Unit scopes:

```text
UNIT_ONLY
UNIT_AND_DESCENDANTS
```

A policy is active only when:

```text
isActive = true
AND
revokedAt = null
AND
validFrom <= now
AND
(
    validUntil = null
    OR validUntil > now
)
```

Security enforcement does not depend on cleanup jobs.

---

# 11. Authorization Resolution

The user may match policies through:

```text
ORGANIZATION
UNIT
ROLE
USER
```

Resolution for each action:

```text
Any Matching DENY
→ DENY

No DENY + Matching ALLOW
→ ALLOW

No Matching Policy
→ DENY
```

Explicit `DENY` always wins regardless of subject type.

The system does not use specificity precedence such as:

```text
USER > UNIT > ROLE > ORGANIZATION
```

For RAG retrieval:

```text
QUERY Denied
→ Document excluded from authorized retrieval
→ Retrieved content rejected
→ Content cannot reach the LLM
```

---

# 12. Temporary Access

Temporary access uses:

```text
validFrom
validUntil
```

Initial configurable limit:

```text
Maximum temporary access → 7 days
```

Rules:

```text
validUntil > validFrom
validUntil <= validFrom + configured maximum
```

Expired access is rejected during authorization even before housekeeping updates the policy record.

---

# 13. Access Changes and Audit History

Access changes use a controlled transactional flow:

```text
Validate Authority
→ Validate Policy
→ Mutate Access
→ Create Audit Record
→ Commit
```

Any failure rolls back both the policy mutation and audit insertion.

Core rule:

```text
No access mutation
without an audit record.
```

Current state and history remain separate:

```text
DocumentAccessPolicy → Current authorization state
DocumentAccessAudit  → Append-only history
```

Audit events:

```text
CREATED
UPDATED
REVOKED
EXPIRED
TEMPORARY_GRANTED
TEMPORARY_EXTENDED
```

Audit records store:

```text
Organization and document
Policy reference
Actor
Subject snapshot
Event type
Previous state
New state
Reason
Timestamp
```

Audit records cannot be edited or deleted through normal application operations.

---

# 14. Phase 5 Service Invariants

All document mutations must validate tenant consistency.

## Document

```text
organizationId must match the uploader's organization
```

## Document Version

```text
Version must belong to the target document

Document.currentVersionId
→ Must reference a version of the same document
```

## Access Policy

```text
Policy organization
→ Must match document organization
```

Subject validation:

```text
ORGANIZATION
→ subjectOrganizationId required
→ Other subject fields null
→ Organization must match document organization
→ Scope null

UNIT
→ subjectUnitId required
→ Other subject fields null
→ Unit must belong to document organization
→ Scope required

ROLE
→ subjectRole required
→ Other subject fields null
→ Scope null

USER
→ subjectUserId required
→ Other subject fields null
→ User must belong to document organization
→ Scope null
```

Every access mutation must:

```text
Validate Authority
→ Mutate Policy
→ Insert Audit Record
→ Commit in One Transaction
```

---

# 15. Deletion and Cleanup

Deletion must block access before physical cleanup.

```text
Delete Request
→ Mark Document DELETED
→ Reject Retrieval and Access
→ Invalidate Cache
→ Queue Cleanup
```

Asynchronous cleanup may remove:

```text
Qdrant → Document vectors
S3     → Stored objects
Redis  → Cached data
```

Cleanup failure must never become a security failure.

```text
PostgreSQL says DELETED
→ Content cannot reach the LLM

Old storage or vectors still exist
→ Authorization still rejects them
```

---

# 16. Future Document Processing

Phase 6 will finalize:

```text
DocumentVersion
└── Page
    └── ContentBlock
        └── Chunk
```

Responsibilities:

```text
DocumentVersion → Source version
Page            → Visual and layout unit
ContentBlock    → Semantic and structural unit
Chunk           → Retrieval unit
```

Planned content types:

```text
TEXT
TABLE
IMAGE
CHART
DIAGRAM
```

These models are intentionally not included in the current Prisma schema.

---

# 17. Future Retrieval Architecture

Qdrant points will contain stable ownership and source identifiers:

```text
organizationId
documentId
documentVersionId
pageId
contentBlockId
chunkId
contentType
```

Access lists will not be the primary authorization source inside Qdrant.

Future retrieval flow:

```text
Resolve User
→ Resolve Authorized Documents
→ Search Correct Vector Placement
→ Filter Authorized Content
→ Revalidate Retrieved Resources
→ Reconstruct Context
→ Rerank
→ Final Authorization Check
→ LLM
```

---

# 18. Future Vector Multitenancy

Long-term architecture:

```text
One Collection per Embedding Configuration
+
Shared Shard Pool
+
Dedicated Shards
```

PostgreSQL may later track explicit organization placement:

```text
OrganizationVectorPlacement

organizationId
collectionName
shardKey
placementType
migrationState
```

Possible placement types:

```text
SHARED
DEDICATED_SHARD
DEDICATED_CLUSTER
```

Vector placement and migration are future Phase 7 and scaling work and are not included in the current Prisma schema.

---

# 19. Referential Integrity

Required invariants:

```text
Document.organizationId
→ Valid organization

Document.uploadedById
→ Valid user in the same organization

Document.currentVersionId
→ Version belonging to the same document

DocumentVersion.documentId
→ Valid document

DocumentAccessPolicy.organizationId
→ Same organization as document

Policy subjects
→ Must belong to the document organization

DocumentAccessAudit.organizationId
→ Same organization as document
```

Foreign keys enforce direct relations.

Cross-organization and polymorphic subject rules are additionally enforced transactionally in the service layer.

Deletion behavior must preserve audit history.

---

# 20. Phase Boundaries

## Phase 5 — Document Management

```text
Document and versions
Document lifecycle
Draft expiry
S3 mapping
Classification
Access policies
Temporary access
Access audit history
Authorized downloads
Soft deletion
Processing status
```

## Phase 6 — Document Processing

```text
Layout-aware extraction
OCR
Pages
Content blocks
Tables and charts
Chunking
Processing workers
```

## Phase 7 — Retrieval Infrastructure

```text
Qdrant integration
Embeddings
Vector placement
Tenant routing
Permission-aware retrieval
```

Later scaling work will add shard management and vector migration only when required.

---

# Current Database Status

Completed:

```text
Phase 5 Enums               ✅
Document Model              ✅
DocumentVersion Model       ✅
DocumentAccessPolicy Model  ✅
DocumentAccessAudit Model   ✅
Referential Integrity Review ✅
Prisma Validation           ✅
Database Migration          ✅
Prisma Client Generation    ✅
```

Migration:

```text
20260710095413_add_document_management
```

Future processing and retrieval models remain architectural placeholders until their implementation phases.

---

# Next Development Step

```text
Phase 5.2 — Document Lifecycle

Implement Draft Creation
→ Implement Draft Expiry
→ Implement Metadata Updates
→ Implement Lifecycle Validation
→ Implement Document Retrieval
```
