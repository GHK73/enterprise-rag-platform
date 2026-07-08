# RAG Database Schema

Database design for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

> **Current Phase:** Phase 5 — Document Management Architecture

---

# Overview

| Item | Value |
| --- | --- |
| Database | PostgreSQL |
| ORM | Prisma |
| Connection | `DATABASE_URL` |
| Schema | `backend/prisma/schema.prisma` |
| File Storage | Amazon S3 |
| Vector Storage | Qdrant |

The database currently supports:

* Authentication
* Organizations and hierarchy
* Internal roles
* Scoped permissions
* Permission delegation and revocation
* Organization unit capacity
* Invitations
* Member management
* Unit reorganization

The next schema extension will support:

* Documents
* Document versions
* Time-aware access policies
* Processing status
* Document chunks
* S3 object references
* Qdrant vector mappings

---

# Core Architecture

~~~text
PostgreSQL
→ Application source of truth
→ Organizations
→ Users
→ Permissions
→ Documents
→ Versions
→ Access policies
→ Chunks
→ Processing state

Amazon S3
→ Original files
→ Versioned file objects
→ Processed artifacts

Qdrant
→ Embedding vectors
→ Chunk references
→ Filtered vector retrieval
~~~

The database stores metadata and references. Large files and embedding vectors are not stored directly in PostgreSQL.

---

# Authorization Model

The platform uses scoped, delegated authorization:

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
→ Internal organizational classification

Permission
→ Action the user may perform

Scope
→ Organization subtree where the action applies

Delegation
→ Authority that granted the permission
~~~

Roles do not directly grant access.

Example:

~~~text
User
├── Role: MANAGER
├── Unit: Backend
└── Permission Grant
      ├── Permission: INVITE_MEMBER
      ├── Scope: Backend
      ├── Granted By: Engineering Head
      └── Can Delegate: true
~~~

The permission applies to `Backend` and its descendants, but not to parents, siblings, or other branches.

---

# Organization Hierarchy

~~~text
COMPANY → DEPARTMENT → TEAM → GROUP
~~~

Valid parent relationships:

~~~text
DEPARTMENT → COMPANY
TEAM       → DEPARTMENT
GROUP      → TEAM
COMPANY    → No Parent
~~~

Example:

~~~text
Company
├── Engineering
│   ├── Backend
│   │   ├── API Group
│   │   └── Platform Group
│   └── Frontend
├── HR
└── Finance
~~~

A permission scoped to `Backend` applies to:

~~~text
Backend          ✅
API Group        ✅
Platform Group   ✅

Engineering      ❌
Frontend         ❌
HR               ❌
Finance          ❌
~~~

---

# Enums

## Role

| Value | Description |
| --- | --- |
| `OWNER` | Organization owner |
| `ADMIN` | Organization administrator |
| `MANAGER` | Management-level member |
| `MEMBER` | Standard member |

`User.role` is optional until the user creates or joins an organization.

Roles are stable internal identifiers. Actual access is controlled by permission grants.

---

## OrganizationUnitType

| Value | Description |
| --- | --- |
| `COMPANY` | Root organization unit |
| `DEPARTMENT` | Department |
| `TEAM` | Team |
| `GROUP` | Sub-team or group |

---

## Permission

| Permission | Purpose |
| --- | --- |
| `INVITE_MEMBER` | Invite a user |
| `REMOVE_MEMBER` | Remove a member |
| `UPDATE_MEMBER` | Update member information |
| `ASSIGN_ROLE` | Assign an internal role |
| `MOVE_MEMBER` | Move a member between units |
| `CREATE_UNIT` | Create organization units |
| `UPDATE_UNIT` | Update organization units |
| `DELETE_UNIT` | Delete organization units |
| `MOVE_UNIT` | Move units between valid parents |

Future permissions will cover documents, retrieval, analytics, and administration.

---

## InvitationStatus

| Value | Description |
| --- | --- |
| `PENDING` | Waiting for acceptance |
| `ACCEPTED` | Accepted |
| `EXPIRED` | No longer valid |
| `REVOKED` | Cancelled |

---

# Current Entity Relationships

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

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Primary key |
| `name` | `String` | Organization name |
| `description` | `String?` | Optional description |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update |

Relations:

* OrganizationUnits
* PermissionGrants
* Invitations

---

## OrganizationUnit

Represents a node in the organization hierarchy.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Primary key |
| `name` | `String` | Unit name |
| `type` | `OrganizationUnitType` | Unit type |
| `organizationId` | `String` | Organization |
| `parentId` | `String?` | Parent unit |
| `allocatedCapacity` | `Int?` | Capacity allocated to the subtree |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update |

Relations:

* Organization
* Parent and children
* Users
* PermissionGrants
* Invitations

Indexes:

* `organizationId`
* `parentId`

---

## User

Authenticated user with optional organization membership.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Primary key |
| `fullName` | `String` | Full name |
| `email` | `String` | Unique email |
| `passwordHash` | `String` | Hashed password |
| `role` | `Role?` | Internal role |
| `isActive` | `Boolean` | Account status |
| `isVerified` | `Boolean` | Verification status |
| `unitId` | `String?` | Assigned unit |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update |

Relations:

* OrganizationUnit
* Received PermissionGrants
* Given PermissionGrants
* Sent Invitations

A user outside an organization has:

~~~text
role   = null
unitId = null
~~~

---

## PermissionGrant

Represents an atomic permission delegated within a hierarchy scope.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Primary key |
| `permission` | `Permission` | Granted action |
| `organizationId` | `String` | Organization |
| `userId` | `String` | Receiving user |
| `scopeUnitId` | `String` | Allowed subtree |
| `grantedById` | `String` | Granting user |
| `canDelegate` | `Boolean` | May delegate permission |
| `isActive` | `Boolean` | Active status |
| `revokedAt` | `DateTime?` | Revocation timestamp |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update |

A permission is valid only when:

~~~text
Grant Is Active
→ Organization Matches
→ Target Is Inside Scope
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

Historical grants are preserved using revoke + new grant.

---

## Invitation

Represents an invitation to join an organization.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | Primary key |
| `email` | `String` | Invited email |
| `organizationId` | `String` | Target organization |
| `unitId` | `String` | Target unit |
| `role` | `Role` | Role after acceptance |
| `invitedById` | `String` | Inviting user |
| `token` | `String` | Unique token |
| `status` | `InvitationStatus` | Lifecycle state |
| `expiresAt` | `DateTime` | Expiration |
| `createdAt` | `DateTime` | Creation timestamp |
| `updatedAt` | `DateTime` | Last update |

Invitation acceptance:

~~~text
Validate Token
→ Validate Email
→ Validate Expiry
→ Validate Unit Capacity
→ Assign Unit + Role
→ Mark ACCEPTED
~~~

Permissions are granted separately.

---

# Tree Capacity

Only `allocatedCapacity` is stored.

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Direct Child Allocations
~~~

Example:

~~~text
Engineering Capacity = 100

├── Direct Members = 10
├── Backend Allocation = 40
├── Frontend Allocation = 30
└── Remaining Capacity = 20
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

A child cannot receive more than the parent's available capacity.

Capacity validation is applied during:

* Invitation acceptance
* Capacity updates
* Member movement
* Unit movement

---

# Member Management

Supported operations:

~~~text
Update Role
→ ASSIGN_ROLE

Move Member
→ MOVE_MEMBER on source and destination scopes

Remove Member
→ REMOVE_MEMBER
~~~

All operations validate:

~~~text
Organization Isolation
→ Permission
→ Hierarchy Scope
→ OWNER Protection
→ Operation-Specific Constraints
~~~

Removing a member:

~~~text
Validate REMOVE_MEMBER
→ Validate Scope
→ Protect OWNER
→ Revoke Active Permission Grants
→ Set role = null
→ Set unitId = null
~~~

---

# Unit Reorganization

Units can move between valid parents.

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
~~~

Rules:

~~~text
COMPANY
→ Cannot Move

DEPARTMENT
→ COMPANY only

TEAM
→ DEPARTMENT only

GROUP
→ TEAM only
~~~

Permission delegation history is not rewritten when a unit moves.

---

# Phase 5 — Planned Document Architecture

The document system will separate application metadata, file storage, and vector storage.

~~~text
PostgreSQL
→ Document metadata
→ Versions
→ Access policies
→ Processing status
→ Chunks
→ Storage references
→ Vector references

Amazon S3
→ Original files
→ Versioned objects
→ Processed artifacts

Qdrant
→ Embedding vectors
→ Chunk references
→ Retrieval metadata
~~~

---

# Planned Document Relationships

~~~text
Organization
└── Documents
      ├── DocumentVersions
      │     └── DocumentChunks
      │            └── Qdrant Point
      │
      └── DocumentAccessPolicies
~~~

Planned relationship model:

~~~mermaid
erDiagram
    Organization ||--o{ Document : owns
    User ||--o{ Document : uploads

    Document ||--o{ DocumentVersion : versions
    Document ||--o{ DocumentAccessPolicy : controls

    DocumentVersion ||--o{ DocumentChunk : contains

    DocumentChunk ||--o| QdrantPoint : maps
~~~

`QdrantPoint` is a conceptual external mapping, not necessarily a PostgreSQL model.

---

# Planned Document Model

Represents the logical document across all versions.

Planned responsibilities:

* Organization ownership
* Display metadata
* Current version reference
* Lifecycle status
* Soft deletion
* Access policies

Expected fields:

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

The `Document` record does not store the actual file.

---

# Planned DocumentVersion Model

Represents one immutable application-level version.

Expected fields:

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

Application versioning and S3 versioning solve different problems:

~~~text
DocumentVersion
→ Business history
→ Processing history
→ Chunk ownership
→ Embedding ownership
→ Rollback

S3 Versioning
→ Storage protection
→ Object recovery
~~~

The application will maintain its own version records even if S3 versioning is enabled.

---

# Planned S3 Storage Model

S3 stores file objects, not access-control truth.

Recommended object key structure:

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

PostgreSQL stores the S3 object key:

~~~text
organizations/{organizationId}/documents/{documentId}/versions/{versionId}/original
~~~

The database should not store permanent public URLs.

Download flow:

~~~text
User Requests Download
→ Authenticate
→ Validate Active Document Access
→ Generate Short-Lived S3 Presigned URL
→ Download
~~~

The S3 bucket remains private.

---

# Planned Document Access Model

Document access is separate from organizational operation permissions.

The system must answer two different questions:

~~~text
PermissionGrant
→ May this user perform an operation?

DocumentAccessPolicy
→ May this user access this document?
~~~

Planned access subjects:

~~~text
ORGANIZATION
UNIT
USER
ROLE
~~~

Planned access permissions:

~~~text
VIEW
DOWNLOAD
UPDATE
DELETE
MANAGE_ACCESS
~~~

Access policies may be permanent or time-bound.

Expected fields:

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

An access policy is valid when:

~~~text
isActive = true
AND revokedAt = null
AND validFrom <= now
AND (
    validUntil = null
    OR validUntil > now
)
~~~

---

# Temporary and Scheduled Access

Access changes do not move or duplicate document data.

Example:

~~~text
July 1 → July 15
Finance only

July 15 → August 1
Finance + Managers

After August 1
Entire Organization
~~~

This is represented using separate policies:

~~~text
Policy A
Subject    = Finance Unit
Valid From = July 1
Valid Until = July 15

Policy B
Subject    = MANAGER Role
Valid From = July 15
Valid Until = August 1

Policy C
Subject    = ORGANIZATION
Valid From = August 1
Valid Until = null
~~~

At the transition time:

~~~text
S3 File          → Unchanged
Document Record  → Unchanged
Chunks           → Unchanged
Qdrant Vectors   → Unchanged
Active Policy    → Changes Automatically
~~~

PostgreSQL remains the authorization authority.

---

# Planned DocumentChunk Model

Represents one retrievable text segment from a document version.

Expected fields:

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

PostgreSQL stores:

* Chunk text
* Chunk order
* Content hash
* Document and version relationships
* Qdrant point mapping

Qdrant stores:

* Embedding vector
* Retrieval metadata

---

# Planned Qdrant Mapping

Each Qdrant point will contain a vector and stable identifiers.

~~~text
Vector

Payload:
{
    organizationId,
    documentId,
    versionId,
    chunkId,
    isCurrentVersion
}
~~~

Frequently changing ACL lists should not be copied as the only authorization source into every vector.

Retrieval flow:

~~~text
User Query
→ Resolve Active Access in PostgreSQL
→ Determine Authorized Documents
→ Search Qdrant with Filters
→ Return Candidate Chunks
→ Final Authorization Validation
→ Rerank
→ Send Authorized Context to LLM
~~~

The LLM must never receive unauthorized document content.

---

# Planned Document Processing Lifecycle

~~~text
Upload Requested
→ Validate User Permission
→ Create Document
→ Create DocumentVersion
→ Upload File to S3
→ Mark QUEUED
→ Add BullMQ Job
→ Extract Text / OCR
→ Chunk Content
→ Store Chunks
→ Generate Embeddings
→ Index in Qdrant
→ Mark READY
~~~

Planned statuses:

~~~text
UPLOADING
QUEUED
PROCESSING
READY
FAILED
~~~

---

# Referential Integrity

Current relationships:

| Relationship | On Delete |
| --- | --- |
| OrganizationUnit → Organization | Cascade |
| OrganizationUnit → Parent Unit | Cascade |
| User → OrganizationUnit | Restrict |
| PermissionGrant → Organization | Cascade |
| PermissionGrant → Receiving User | Cascade |
| PermissionGrant → Scope Unit | Cascade |
| PermissionGrant → Granting User | Restrict |
| Invitation → Organization | Cascade |
| Invitation → OrganizationUnit | Cascade |
| Invitation → Inviting User | Restrict |

Document referential rules will be finalized before updating `schema.prisma`.

---

# Current Status

| Component | Status |
| --- | --- |
| PostgreSQL and Prisma | ✅ |
| Authentication schema | ✅ |
| Organization schema | ✅ |
| Hierarchy schema | ✅ |
| Permission schema | ✅ |
| Invitation schema | ✅ |
| Capacity foundation | ✅ |
| Member management support | ✅ |
| Unit reorganization support | ✅ |
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
→ S3 Storage Mapping
→ Qdrant Mapping
→ Processing Lifecycle
→ Referential Integrity
→ Update schema.prisma
~~~

No Prisma document models should be added until these relationships and lifecycle rules are finalized.