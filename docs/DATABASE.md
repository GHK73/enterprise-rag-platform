# RAG Database Schema

Database architecture for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

> **Current Phase:** Phase 5 — Document Management Architecture

---

# Overview

| Component | Technology |
| --- | --- |
| Database | PostgreSQL |
| ORM | Prisma |
| File Storage | Amazon S3 |
| Vector Storage | Qdrant |
| Background Jobs | Redis + BullMQ |

~~~text
PostgreSQL
→ Application source of truth
→ Users and organizations
→ Permissions and access policies
→ Document metadata and chunks

Amazon S3
→ Original files
→ Versioned objects
→ Processed artifacts

Qdrant
→ Embedding vectors
→ Chunk references
→ Filtered retrieval
~~~

Large files and embedding vectors are not stored directly in PostgreSQL.

---

# Current Architecture

## Organization Hierarchy

~~~text
COMPANY → DEPARTMENT → TEAM → GROUP
~~~

Valid relationships:

~~~text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → No Parent
~~~

---

## Authorization Model

~~~text
Effective Access
=
Permission
AND
Hierarchy Scope
AND
Valid Delegation
~~~

The system separates:

~~~text
Role
→ Organizational classification

Permission
→ Allowed operation

Scope
→ Organization subtree

Delegation
→ Authority to grant the permission
~~~

Roles do not directly grant access.

A permission scoped to a unit applies to that unit and its descendants.

---

# Current Enums

## Role

~~~text
OWNER
ADMIN
MANAGER
MEMBER
~~~

`User.role` remains `null` until the user creates or joins an organization.

---

## OrganizationUnitType

~~~text
COMPANY
DEPARTMENT
TEAM
GROUP
~~~

---

## Permission

~~~text
INVITE_MEMBER
REMOVE_MEMBER
UPDATE_MEMBER
ASSIGN_ROLE
MOVE_MEMBER

CREATE_UNIT
UPDATE_UNIT
DELETE_UNIT
MOVE_UNIT
~~~

Future permissions will cover documents, retrieval, analytics, and administration.

---

## InvitationStatus

~~~text
PENDING
ACCEPTED
EXPIRED
REVOKED
~~~

---

# Current Relationships

~~~text
Organization
├── OrganizationUnits
├── PermissionGrants
└── Invitations

OrganizationUnit
├── Parent / Children
├── Users
├── PermissionGrants
└── Invitations

User
├── Assigned Unit
├── Received PermissionGrants
├── Given PermissionGrants
└── Sent Invitations
~~~

~~~mermaid
erDiagram
    Organization ||--o{ OrganizationUnit : contains
    Organization ||--o{ PermissionGrant : owns
    Organization ||--o{ Invitation : owns

    OrganizationUnit ||--o{ OrganizationUnit : parent
    OrganizationUnit ||--o{ User : assigns
    OrganizationUnit ||--o{ PermissionGrant : scopes
    OrganizationUnit ||--o{ Invitation : targets

    User ||--o{ PermissionGrant : receives
    User ||--o{ PermissionGrant : grants
    User ||--o{ Invitation : sends
~~~

---

# Current Models

## Organization

Top-level tenant.

~~~text
id
name
description
revision
createdAt
updatedAt
~~~

Relations:

* OrganizationUnits
* PermissionGrants
* Invitations

`revision` is a monotonically increasing number used for lightweight multi-user synchronization.

Every successful organization-changing transaction increments it.

~~~text
Organization Change
+
Revision Increment
→ Commit Together
or
→ Roll Back Together
~~~

Covered changes include:

* Organization updates
* Unit creation, rename, movement, and deletion
* Capacity updates
* Member role updates
* Member movement and removal
* Invitation acceptance

---

## OrganizationUnit

Represents one node in the hierarchy.

~~~text
id
name
type
organizationId
parentId
allocatedCapacity
createdAt
updatedAt
~~~

Relations:

* Organization
* Parent and children
* Users
* PermissionGrants
* Invitations

Indexes:

~~~text
organizationId
parentId
~~~

---

## User

Authenticated user with optional organization membership.

~~~text
id
fullName
email
passwordHash
role
isActive
isVerified
unitId
createdAt
updatedAt
~~~

A user outside an organization has:

~~~text
role   = null
unitId = null
~~~

---

## PermissionGrant

Represents one delegated permission.

~~~text
id
permission
organizationId
userId
scopeUnitId
grantedById
canDelegate
isActive
revokedAt
createdAt
updatedAt
~~~

A grant is valid when:

~~~text
Active Grant
→ Organization Matches
→ Target Inside Scope
→ ALLOW
~~~

Delegation requires:

~~~text
Has Permission
→ Can Delegate
→ Recipient Inside Scope
→ New Scope Inside Current Scope
→ Create Grant
~~~

Historical grants are preserved through revocation rather than deletion.

---

## Invitation

Represents an invitation to join an organization.

~~~text
id
email
organizationId
unitId
role
invitedById
token
status
expiresAt
createdAt
updatedAt
~~~

Acceptance flow:

~~~text
Validate Token
→ Validate Email + Expiry
→ Validate Capacity
→ Assign Unit + Role
→ Mark ACCEPTED
→ Increment Organization Revision
~~~

Permissions remain separate from membership.

---

# Capacity Model

Only `allocatedCapacity` is stored.

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Direct Child Allocations
~~~

Capacity flows downward:

~~~text
COMPANY
↓
DEPARTMENT
↓
TEAM
↓
GROUP
~~~

A child cannot receive more than its parent's available capacity.

Capacity validation is applied during:

* Capacity updates
* Invitation acceptance
* Member movement
* Unit movement

---

# Member Management

Supported operations:

~~~text
Update Role
→ ASSIGN_ROLE

Move Member
→ MOVE_MEMBER on source and destination

Remove Member
→ REMOVE_MEMBER
~~~

All operations validate organization isolation, permission scope, owner protection, and operation-specific constraints.

Removing a member:

~~~text
Validate Permission
→ Revoke Active Grants
→ Set role = null
→ Set unitId = null
→ Increment Revision
~~~

---

# Unit Reorganization

~~~text
Select Unit
→ Select New Parent
→ Validate Organization
→ Validate Hierarchy
→ Prevent Circular Reference
→ Validate Source Scope
→ Validate Destination Scope
→ Validate Capacity
→ Update parentId
→ Increment Revision
~~~

Rules:

~~~text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → Cannot Move
~~~

Permission history is not rewritten when a unit moves.

---

# Organization Synchronization

The system uses revision-based stale-state detection.

~~~text
Frontend Loads Organization
→ Store Revision

Later
→ Fetch Current Revision

Same Revision
→ No Action

Different Revision
→ Organization State Is Stale
→ Fetch Latest Data
~~~

This avoids frequent full-data polling while supporting multi-user organization changes.

---

# Phase 5 — Planned Document Architecture

The document system separates metadata, file storage, and vector storage.

~~~text
PostgreSQL
→ Documents
→ Versions
→ Access Policies
→ Processing State
→ Chunks
→ External Storage References

Amazon S3
→ Original Files
→ Versioned Objects
→ Processed Artifacts

Qdrant
→ Embeddings
→ Chunk References
→ Retrieval Metadata
~~~

---

# Planned Relationships

~~~text
Organization
└── Documents
      ├── DocumentVersions
      │     └── DocumentChunks
      │            └── Qdrant Point
      │
      └── DocumentAccessPolicies
~~~

~~~mermaid
erDiagram
    Organization ||--o{ Document : owns
    User ||--o{ Document : uploads

    Document ||--o{ DocumentVersion : versions
    Document ||--o{ DocumentAccessPolicy : controls

    DocumentVersion ||--o{ DocumentChunk : contains
~~~

Qdrant points are external vector records, not necessarily PostgreSQL models.

---

# Planned Document Model

Represents one logical document across all versions.

~~~text
id
organizationId
title
description
currentVersionId
uploadedById
isDeleted
deletedAt
createdAt
updatedAt
~~~

Responsibilities:

* Organization ownership
* Display metadata
* Current version reference
* Lifecycle state
* Soft deletion
* Access policies

The actual file is not stored in the database.

---

# Planned DocumentVersion Model

Represents one immutable application-level version.

~~~text
id
documentId
versionNumber

storageProvider
storageBucket
storageKey

originalFileName
mimeType
fileSize
checksum

processingStatus

createdById
createdAt
~~~

~~~text
DocumentVersion
→ Business and processing history
→ Chunk ownership
→ Embedding ownership
→ Rollback

S3 Versioning
→ Storage protection
→ Object recovery
~~~

Application versions remain separate from S3 object versioning.

---

# Planned S3 Storage

~~~text
organizations/
└── {organizationId}/
    └── documents/
        └── {documentId}/
            └── versions/
                └── {versionId}/
                    ├── original
                    ├── extracted.txt
                    └── ocr.json
~~~

PostgreSQL stores object keys, not permanent public URLs.

Download flow:

~~~text
Request Download
→ Authenticate
→ Validate Document Access
→ Generate Short-Lived Presigned URL
→ Download
~~~

The S3 bucket remains private.

---

# Planned Document Access

Document access is separate from organization operation permissions.

~~~text
PermissionGrant
→ May the user perform an operation?

DocumentAccessPolicy
→ May the user access this document?
~~~

Subjects:

~~~text
ORGANIZATION
UNIT
USER
ROLE
~~~

Permissions:

~~~text
VIEW
DOWNLOAD
UPDATE
DELETE
MANAGE_ACCESS
~~~

Expected policy fields:

~~~text
id
documentId
subjectType

unitId
userId
role

permission

validFrom
validUntil

grantedById
isActive
revokedAt

createdAt
updatedAt
~~~

A policy is active when:

~~~text
isActive = true
AND revokedAt = null
AND validFrom <= now
AND (
    validUntil = null
    OR validUntil > now
)
~~~

Time-based policies allow temporary access and scheduled document release without moving files or rebuilding embeddings.

---

# Planned DocumentChunk Model

Represents one retrievable text segment.

~~~text
id
documentId
versionId
chunkIndex
content
contentHash
tokenCount
qdrantPointId
createdAt
~~~

PostgreSQL stores chunk content and relationships.

Qdrant stores embedding vectors and retrieval metadata.

---

# Planned Qdrant Mapping

Each vector contains stable identifiers:

~~~text
{
    organizationId,
    documentId,
    versionId,
    chunkId,
    isCurrentVersion
}
~~~

Frequently changing access lists will not be treated as the only authorization source inside Qdrant.

Retrieval flow:

~~~text
User Query
→ Resolve Access in PostgreSQL
→ Determine Authorized Documents
→ Search Qdrant with Filters
→ Validate Authorization Again
→ Rerank
→ Send Authorized Context to LLM
~~~

Unauthorized content must never reach the LLM.

---

# Planned Processing Lifecycle

~~~text
Upload Requested
→ Validate Permission
→ Create Document + Version
→ Upload to S3
→ Mark QUEUED
→ Add BullMQ Job
→ Extract Text / OCR
→ Create Chunks
→ Generate Embeddings
→ Index in Qdrant
→ Mark READY
~~~

Statuses:

~~~text
UPLOADING
QUEUED
PROCESSING
READY
FAILED
~~~

---

# Current Status

| Component | Status |
| --- | --- |
| PostgreSQL and Prisma | ✅ |
| Authentication | ✅ |
| Organization hierarchy | ✅ |
| Permissions and invitations | ✅ |
| Capacity and member management | ✅ |
| Unit reorganization | ✅ |
| Organization synchronization | ✅ |
| Document architecture | ⏳ |
| Document schema | ⏳ |
| S3 integration | ⏳ |
| Qdrant integration | ⏳ |

---

# Next Development Step

~~~text
Phase 5.1 — Finalize Document Architecture

Document Model
→ DocumentVersion Model
→ DocumentAccessPolicy Model
→ DocumentChunk Model
→ S3 Mapping
→ Qdrant Mapping
→ Processing Lifecycle
→ Referential Integrity
→ Update schema.prisma
~~~

No Prisma document models should be added until the relationships and lifecycle rules are finalized.