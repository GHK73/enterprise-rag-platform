# RAG Database Architecture

Database design for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

> **Current Phase:** Phase 5 — Document Management Architecture

---

# 1. Storage Responsibilities

```text
PostgreSQL
→ Application source of truth
→ Organizations and users
→ Administrative permissions
→ Document metadata and versions
→ Access policies and audit history
→ Processing state
→ Vector placement

Amazon S3
→ Temporary uploads
→ Original versioned files
→ Extracted and visual artifacts

Qdrant
→ Embeddings
→ Retrieval metadata
→ Chunk references

Redis + BullMQ
→ Background processing
→ Cleanup jobs
→ Caching
→ Future vector migration jobs
```

Large files and embedding vectors are not stored directly in PostgreSQL.

The core rule is:

```text
PostgreSQL
→ Authorization authority

Qdrant
→ Retrieval infrastructure
```

Unauthorized content must never reach the LLM.

---

# 2. Existing Organization Model

## Hierarchy

```text
COMPANY → DEPARTMENT → TEAM → GROUP
```

Valid parent relationships:

```text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → No Parent
```

## Administrative Authorization

```text
Effective Authority
=
Permission
+
Hierarchy Scope
+
Delegation Authority
```

Roles classify members.

Permissions control operations.

Administrative permissions do not grant document access.

```text
Administrative Authority
≠
Knowledge Access
```

## Existing Core Models

```text
Organization
├── OrganizationUnit
├── PermissionGrant
└── Invitation

OrganizationUnit
├── Parent / Children
├── Users
├── PermissionGrants
└── Invitations

User
├── Assigned Unit
├── Received PermissionGrants
├── Given PermissionGrants
└── Invitations
```

Detailed organization, permission, capacity, synchronization, and concurrency behavior is documented in the backend development log.

---

# 3. Document Architecture

The document system separates logical documents, immutable versions, source files, access rules, processing state, and retrieval data.

```text
Organization
└── Document
    ├── DocumentVersion
    │   └── Future Processing Structure
    │       ├── Page
    │       ├── ContentBlock
    │       └── Chunk
    │
    ├── DocumentAccessPolicy
    └── DocumentAccessAudit
```

A logical document may have many versions, but only one current version.

```text
Document
├── Version 1
├── Version 2
└── Version 3 ← Current
```

---

# 4. Document Lifecycle

A file cannot remain permanently as unused S3 storage.

```text
DRAFT
→ SUBMITTED
→ QUEUED
→ PROCESSING
→ READY
```

Failure flow:

```text
PROCESSING
→ FAILED
→ RETRY
```

Draft expiry:

```text
DRAFT
→ EXPIRED
→ S3 CLEANUP
```

Deletion:

```text
READY
→ DELETED
→ ASYNC CLEANUP
```

## Lifecycle Rules

### DRAFT

The file is temporarily stored in S3 while the uploader configures:

* Metadata
* Classification
* Access policies

A draft must be published before its expiry time.

Initial platform rule:

```text
Maximum S3-only draft period
→ 24 hours
```

The exact duration should remain configurable.

### SUBMITTED

The document configuration has been validated and accepted.

The initial access state is recorded before processing begins.

### QUEUED

A background processing job has been created.

### PROCESSING

The current version is being extracted, structured, chunked, embedded, and indexed.

### READY

The document is available for authorized retrieval.

### FAILED

Processing failed after submission.

The document may remain for retry and investigation.

### EXPIRED

An unpublished draft exceeded its staging period.

Its temporary S3 object is scheduled for deletion.

### DELETED

The document is immediately blocked from retrieval.

Physical cleanup occurs asynchronously.

---

# 5. Document Model

Represents one logical document across all versions.

```text
Document

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
* Display metadata
* Data classification
* Lifecycle state
* Current version reference
* Draft expiry
* Soft deletion

The actual file is stored in S3.

---

# 6. Document Version Model

Represents one immutable application-level version.

```text
DocumentVersion

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
Extracted artifacts
Chunks
Qdrant vectors
```

Application versioning remains separate from S3 object versioning.

```text
DocumentVersion
→ Business and retrieval history

S3 Versioning
→ Storage recovery and protection
```

Initial access should remain document-level.

```text
Document
→ Owns access policies

DocumentVersion
→ Inherits document access
```

Version-specific access is not planned for the initial implementation.

---

# 7. S3 Storage Model

## Draft Storage

```text
organizations/
└── {organizationId}/
    └── drafts/
        └── {documentId}/
            └── original
```

Draft objects are temporary.

## Published Version Storage

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

Future artifacts may include:

```text
Extracted text
OCR output
Table data
Chart crops
Image crops
Layout metadata
```

PostgreSQL stores object references, not permanent public URLs.

The S3 bucket remains private.

Authorized downloads use short-lived presigned URLs.

---

# 8. Data Classification

Data classification describes sensitivity.

It does not directly describe a user's organizational role.

Initial classifications:

```text
GENERAL
INTERNAL
CONFIDENTIAL
RESTRICTED
```

The platform must not use:

```text
EMPLOYEE → Low-level data
MANAGER  → Higher-level data
OWNER    → All data
```

A senior member in one department must not automatically access confidential data from another department.

```text
Role
→ Administrative classification

Classification
→ Data sensitivity

Access Policy
→ Actual authorization
```

Classification rules may later become organization-configurable.

---

# 9. Document Access Model

Document access is independent of administrative permissions.

```text
PermissionGrant
→ May the user perform an administrative operation?

DocumentAccessPolicy
→ May the user access this document?
```

## Access Subjects

```text
ORGANIZATION
UNIT
ROLE
USER
```

`GROUP` is already represented by the organization hierarchy as an `OrganizationUnit` type and therefore does not require a separate access subject type.

## Access Actions

Initial actions:

```text
QUERY
VIEW
DOWNLOAD
MANAGE_ACCESS
```

`QUERY` controls whether document content may participate in retrieval and reach the RAG pipeline.

`VIEW` controls document visibility and details.

`DOWNLOAD` controls access to the original file.

`MANAGE_ACCESS` controls access-policy changes.

These actions remain independent.

---

# 10. Document Access Policy Model

Represents current document authorization state.

```text
DocumentAccessPolicy

id
organizationId
documentId

subjectType
subjectId

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

## Effect

```text
ALLOW
DENY
```

DENY support and precedence rules must be finalized before implementation.

## Unit Scope

For `UNIT` subjects:

```text
UNIT_ONLY

UNIT_AND_DESCENDANTS
```

This prevents ambiguous hierarchy inheritance.

## Active Policy Rule

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

Security correctness must not depend on cleanup jobs.

Expired access is rejected during authorization even if the policy record has not yet been cleaned up.

---

# 11. Temporary Access

Temporary access is a first-class policy type.

```text
validFrom
validUntil
```

Initial platform rule:

```text
validUntil
≤
validFrom + 7 days
```

Temporary access expires automatically during authorization checks.

A background worker may update expired policy state for housekeeping, but it is not responsible for security enforcement.

Permanent access and temporary access remain separate concepts.

---

# 12. Access Changes

Initial access is configured before publication.

After publication, access is not casually overwritten.

Changes require a controlled operation:

```text
Validate Authority
→ Validate New Policy
→ Change Current Access
→ Create Audit Record
→ Increment Access Revision
→ Commit
```

Emergency revocation must always be possible.

```text
Revoke Access
→ PostgreSQL blocks access immediately
→ Invalidate related cache
→ No vector rebuild required
```

Access changes do not require Qdrant reindexing because Qdrant is not the authorization authority.

---

# 13. Document Access Audit

Every access mutation creates an immutable history record.

```text
No access mutation
without an audit record.
```

Current state and history remain separate:

```text
DocumentAccessPolicy
→ Current authorization state

DocumentAccessAudit
→ Append-only history
```

## Audit Model

```text
DocumentAccessAudit

id
organizationId
documentId
policyId

actorId
subjectType
subjectId

eventType

previousState
newState

reason
createdAt
```

Possible events:

```text
CREATED
UPDATED
REVOKED
EXPIRED
TEMPORARY_GRANTED
TEMPORARY_EXTENDED
```

Important searchable fields remain explicit columns.

Full before-and-after states may be stored as JSON.

Access policy mutation and audit insertion must occur in the same database transaction.

```text
Begin Transaction
→ Validate Authority
→ Mutate Policy
→ Insert Audit Event
→ Commit

Any Failure
→ Roll Back Everything
```

Audit records are append-only and cannot be edited or deleted through normal application operations.

---

# 14. Future Structure-Preserving Processing

Documents must not be reduced to plain text only.

The future processing model is:

```text
DocumentVersion
└── Page
    └── ContentBlock
        └── Chunk
```

Responsibilities:

```text
DocumentVersion
→ Source version

Page
→ Visual and layout unit

ContentBlock
→ Semantic and structural unit

Chunk
→ Retrieval unit
```

Future content block types:

```text
TEXT
TABLE
IMAGE
CHART
DIAGRAM
```

These models belong to the document-processing phase and should not be fully implemented until extraction architecture is finalized.

---

# 15. Tables and Visual Content

Embeddings are used to find content, not reconstruct it.

```text
Embedding
→ Find Content Block

Content Block Reference
→ Fetch Authoritative Representation

Authoritative Content
→ Validate Access
→ Send to LLM
```

A future table block may preserve:

```text
Page location
Bounding box
Structured rows and columns
Searchable representation
Source artifact
```

A future chart block may preserve:

```text
Original visual crop
Title
Chart type
Extracted values when available
Searchable description
Source page
```

Retrieved content may later expand to nearby structural context such as headings, captions, and explanations.

---

# 16. Future Chunk Model

A chunk is a retrieval unit, not the source of truth for the original document.

Conceptual model:

```text
DocumentChunk

id
organizationId
documentId
versionId
pageId
contentBlockId

chunkIndex
content
contentHash
tokenCount

qdrantPointId
createdAt
```

The exact chunk model should be finalized during the document-processing phase.

---

# 17. Qdrant Mapping

Each vector point must contain stable ownership and source identifiers.

```text
{
    organizationId,
    documentId,
    documentVersionId,
    pageId,
    contentBlockId,
    chunkId,
    contentType
}
```

Frequently changing access lists are not stored as the primary authorization source inside Qdrant.

Retrieval will eventually follow:

```text
Resolve User
→ Resolve Organization
→ Resolve Vector Placement
→ Resolve Authorized Resources
→ Search Correct Qdrant Partition
→ Filter Authorized Content
→ Revalidate Retrieved Resources
→ Reconstruct Context
→ Rerank
→ Final Authorization Check
→ LLM
```

---

# 18. Vector Multitenancy

The long-term vector architecture is:

```text
One Collection per Embedding Configuration
+
Shared Shard Pool
+
Dedicated Shards
```

Example:

```text
Shared Shard 01
├── Small Organization A
├── Small Organization B
└── Small Organization C

Shared Shard 02
├── Small Organization D
└── Small Organization E

Dedicated Shard X
└── Large Organization X
```

The system should avoid both extremes:

````text
One collection per organization
```

and:

~~~text
One permanent flat shared shard
````

Initial implementation may use shared placement, but the database design must allow future migration.

---

# 19. Vector Placement

PostgreSQL should explicitly track where each organization is stored.

Conceptual future model:

```text
OrganizationVectorPlacement

organizationId
collectionName
shardKey
placementType
migrationState
createdAt
updatedAt
```

Placement types:

```text
SHARED
DEDICATED_SHARD
DEDICATED_CLUSTER
```

`DEDICATED_CLUSTER` is future architecture only.

Placement should be explicit rather than derived from a permanent hash function.

---

# 20. Future Vector Migration

Large organizations may move from shared to dedicated placement.

Migration states:

```text
SHARED
→ MIGRATION_PENDING
→ MIGRATING
→ VERIFYING
→ DEDICATED
→ CLEANUP_PENDING
```

Routing during migration:

```text
Before Migration

READ  → Shared
WRITE → Shared
```

```text
During Migration

READ  → Shared + Dedicated
WRITE → Dedicated
```

```text
After Verification

READ  → Dedicated
WRITE → Dedicated
```

After successful verification, the organization's old points are deleted from the shared shard.

Shared shards may also be rebalanced when cumulative growth from many small organizations creates pressure.

Vector migration is a future scaling feature and is not part of the initial Phase 5 implementation.

---

# 21. Ingestion Protection

One organization must not overload shared infrastructure.

Future limits may include:

```text
Per Time Period
→ Maximum files
→ Maximum upload bytes
→ Maximum generated chunks

Concurrent
→ Maximum processing jobs

Storage
→ Maximum active document bytes
→ Maximum vector count
```

These limits protect S3, workers, embedding infrastructure, and Qdrant.

Rate limits control ingestion pressure without permanently blocking legitimate organization growth.

---

# 22. Deletion and Cleanup

Document deletion must block retrieval before physical cleanup begins.

```text
Delete Request
→ Mark Document DELETED
→ Reject Future Retrieval
→ Invalidate Cache
→ Queue Cleanup
```

Asynchronous cleanup:

```text
Qdrant
→ Delete points by organizationId + documentId

S3
→ Delete objects according to retention policy

Redis
→ Remove related cached data
```

For version cleanup:

```text
organizationId
+
documentVersionId
```

Physical cleanup failure must not become a security failure.

```text
PostgreSQL says DELETED
→ Content cannot reach the LLM

Even if old vectors temporarily remain
→ Authorization rejects them
```

---

# 23. Referential Integrity Rules

The document schema must enforce:

```text
Document.organizationId
→ Valid Organization

Document.uploadedById
→ Valid User

Document.currentVersionId
→ Version belonging to the same Document

DocumentVersion.documentId
→ Valid Document

DocumentAccessPolicy.documentId
→ Valid Document

DocumentAccessPolicy.organizationId
→ Same organization as Document

DocumentAccessAudit.documentId
→ Valid Document

DocumentAccessAudit.organizationId
→ Same organization as Document
```

Cross-organization references must never be accepted.

Deletion behavior must preserve audit history.

---

# 24. Phase Boundaries

## Phase 5 — Document Management

Implement:

```text
Document
DocumentVersion
Document lifecycle
Draft expiry
S3 mapping
Classification
Access policies
Temporary access
Access audit history
Soft deletion
Authorized download
Processing status
```

## Phase 6 — Document Processing

Implement:

```text
Layout-aware extraction
Pages
Content blocks
Tables
Charts
Chunking
Processing workers
```

## Phase 7 — Retrieval Infrastructure

Implement:

```text
Qdrant integration
Embeddings
Vector placement
Tenant routing
Permission-aware retrieval
```

## Later Scaling Work

Implement only when required:

```text
Shared shard pool management
Automatic tenant placement
Large-tenant promotion
Shared-shard rebalancing
Dual-read migration
Dedicated clusters
```

---

# Next Database Step

```text
Finalize Phase 5 Enums
→ Finalize Document Model
→ Finalize DocumentVersion Model
→ Finalize DocumentAccessPolicy Model
→ Finalize DocumentAccessAudit Model
→ Validate Referential Integrity
→ Update schema.prisma
```

Only Phase 5 models should be added to Prisma now.

Future processing, retrieval, and vector-scaling models should remain architectural placeholders until their implementation phases.
