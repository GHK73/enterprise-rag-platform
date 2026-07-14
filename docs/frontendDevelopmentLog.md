# Frontend Development Log

Implementation progress for the Enterprise RAG Platform frontend.

Backend reference: [`docs/DEVELOPMENT.md`](DEVELOPMENT.md)

---

# Current Status

**Active Phase:** Phase 5 — Document Management UI

| Area | Status |
| --- | --- |
| Frontend Foundation | ✅ |
| Authentication | ✅ |
| Dashboard | ✅ |
| Organization Management | ✅ |
| Access & Administration UI | ✅ |
| Organization Synchronization | ✅ |
| Document API Layer | ✅ |
| Document Routes & Navigation | ✅ |
| Document Library | ⏳ |
| Draft Upload Flow | ⏳ |
| Document Details | ⏳ |
| Access Management UI | ⏳ |
| Access History UI | ⏳ |
| Deletion & Recovery UI | ⏳ |

---

# Local Setup

```bash
cd frontend
npm install
npm run dev
```

API base URL is configured in `src/api/axios.js`.

JWT authentication is handled through Axios interceptors using the token stored in `localStorage`.

---

# Completed Phases

## Phase 1–2 — Foundation & Authentication ✅

Implemented:

* React + Vite application
* React Router and protected/public routes
* Global styling and responsive Navbar
* Login and Register pages
* AuthContext with session restoration
* JWT authentication and logout
* Axios configuration with automatic token attachment

---

## Phase 3 — Dashboard & Organization ✅

Implemented:

* Dashboard with organization overview
* Organization CRUD
* Recursive hierarchy (`COMPANY → DEPARTMENT → TEAM → GROUP`)
* Unit management
* Member summaries
* Recursive organization tree
* Selected unit details
* Organization module split into reusable components, hooks and utilities

---

## Phase 4 — Access & Administration UI ✅

Implemented:

### Permissions

* Grant permissions
* Revoke permissions
* Delegation support
* Scope selection
* Permission history

### Invitations

* Create invitations
* Accept invitations
* Revoke invitations
* Received invitations

> Email delivery is not implemented yet.

### Members

* Member listing
* Search
* Role updates
* Unit movement
* Removal
* Owner protection

### Capacity

* Capacity allocation
* Remaining capacity
* Validation feedback

### Reorganization

* Unit movement
* Destination filtering
* Validation

### Synchronization

* Revision polling
* Visibility refresh
* Snapshot synchronization

All organization pages communicate directly with the shared Axios instance.

---

# Phase 5 — Document Management UI ⏳

The backend document APIs are available and the frontend implementation is actively progressing.

## Foundation ✅

Implemented:

* Shared `document.api.js`
* Protected document routes
* Document navigation in Navbar

**Routes**

```text
/documents
    → Document Library

/documents/new
    → Create Draft

/documents/:documentId/upload
    → Upload Draft File

/documents/:documentId
    → Document Details
```

---

## Document Library ⏳

Implemented:

* Document listing
* Empty and error states
* Lifecycle status badges
* Classification display
* Current version display
* Last updated timestamp
* Navigation to Document Details
* Search documents
* Filter by classification
* Filter by lifecycle

Remaining:

* Draft expiry visibility
* Deleted document view
* Dashboard quick navigation

---

## Draft Upload Flow ⏳

Implemented:

* Draft creation
* Metadata entry
* File selection
* Client-side validation
* Upload progress
* Upload to backend
* Redirect after successful upload
* Reusable upload components

Remaining:

* Access configuration before publish
* Review & confirmation step
* Draft expiry visibility
* Replace uploaded file
* Delete uploaded file

> Classification values must always match backend enums (`GENERAL`, `CONFIDENTIAL`, etc.).

---

## Document Details ⏳

Implemented:

* Document metadata
* Lifecycle status
* Current version
* Publish draft
* Download latest version
* Version history
* Download previous versions
* Upload new version
* Upload progress
* Client-side validation
* Loading and error states

Remaining:

* Processing state UI
* Failed processing state
* Delete / Restore shortcuts
* Access history shortcut

---

## Access Management ⏳

Implemented:

* Access policy loading
* Organization data loading
* Member data loading
* Policy listing
* Grant access
* Revoke access
* Basic access management UI

Remaining:

* Edit policy
* Temporary access
* Better subject selection
* Validation improvements
* Reason editing
* Scope configuration

---

## Access History ⏳

Implemented:

* API integration

Remaining:

* History table
* Event timeline
* Actor information
* Policy change details
* Read-only audit interface

---

## Deletion & Recovery ⏳

Implemented:

* API integration

Remaining:

* Soft delete dialog
* Restore workflow
* Permanent cleanup
* Deleted document visibility

---

## Target Document Workflow

```text
Create Draft
        │
        ▼
Upload File
        │
        ▼
Configure Access
        │
        ▼
Review
        │
        ▼
Publish
        │
        ▼
Processing
        │
        ▼
Ready
```

The interface should clearly distinguish:

```text
Draft
Queued
Processing
Ready
Failed
Deleted
```
---

# Future Roadmap

| Phase | Focus |
| --- | --- |
| Phase 6 | Processing UI (queue status, OCR, extraction, chunking, indexing, retry handling) |
| Phase 7 | Retrieval Interface (semantic search, streaming responses, citations, refusal states) |
| Phase 8 | Search & Analytics (history, retrieval metrics, usage analytics) |
| Phase 9 | Settings (organization, document policies, retrieval and model configuration) |
| Phase 10 | UI Polish (notifications, dialogs, accessibility, responsive improvements, loading skeletons) |

---

# Frontend Structure

```text
frontend/
└── src/
    ├── api/
    │   ├── axios.js
    │   └── document.api.js
    │
    ├── components/
    │   ├── Navbar/
    │   ├── ProtectedRoute/
    │   └── PublicRoute/
    │
    ├── context/
    │   └── AuthContext.jsx
    │
    ├── layouts/
    │   └── PublicLayout.jsx
    │
    ├── pages/
    │   ├── Home/
    │   ├── Login/
    │   ├── Register/
    │   ├── Dashboard/
    │   ├── CreateOrganization/
    │   ├── Invitations/
    │   ├── Permissions/
    │   ├── Organization/
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   ├── utils/
    │   │   └── Organization.jsx
    │   │
    │   └── Documents/
    │       ├── components/
    │       ├── CreateDocument.jsx
    │       ├── DocumentLibrary.jsx
    │       ├── DocumentDetails.jsx
    │       └── UploadDocument.jsx
    │
    ├── routes/
    │   ├── DocumentRoutes.jsx
    │   └── index.js
    │
    ├── App.jsx
    ├── main.jsx
    └── index.css
```

---

# Next Development Step

## Complete Phase 5

```text
Document Library
    ↓
Deleted documents
Draft expiry
Dashboard shortcut

Draft Upload
    ↓
Access configuration
Review & confirmation
Replace/Delete uploaded file

Document Details
    ↓
Processing & failure UI
Delete / Restore shortcuts

Access Management
    ↓
Edit policy
Temporary access
Scope configuration
Validation improvements

Access History
    ↓
Audit timeline
Policy changes
Actor information

Deletion & Recovery
    ↓
Soft delete
Restore
Permanent cleanup
```

---

# Overall Progress

| Module | Progress |
| --- | --- |
| Frontend Foundation | ✅ Complete |
| Authentication | ✅ Complete |
| Dashboard | ✅ Complete |
| Organization | ✅ Complete |
| Access & Administration | ✅ Complete |
| Document API Layer | ✅ Complete |
| Document Library | ~85% |
| Draft Upload Flow | ~85% |
| Document Details | ~90% |
| Access Management | ~60% |
| Access History | ~20% |
| Deletion & Recovery | ~10% |

Phase 5 is now primarily focused on completing the remaining document-management workflows before moving to **Phase 6 — Document Processing UI**.