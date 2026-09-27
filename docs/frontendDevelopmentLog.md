# Frontend Development Log

Implementation progress for the Enterprise RAG Platform frontend.

Backend reference: [`docs/DEVELOPMENT.md`](DEVELOPMENT.md)

Architecture reference: [`docs/frontendDevelopment.md`](frontendDevelopment.md)

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
| Document Management UI | ⏳ |

---

# Local Setup

```bash
cd frontend
npm install
npm run dev
```

---

# Foundation ✅

Implemented:

- Shared `axios.js` instance with a JWT request interceptor
- Shared `document.api.js` wrapper for every document endpoint
- Protected document routes contributed from `routes/DocumentRoutes.jsx`
- Document navigation in the Navbar
- `AuthContext` with session verification through `GET /auth/me`

**Routes**

```text
/documents                    → Document Library
/documents/new                → Create Draft
/documents/:documentId/upload → Upload Draft File
/documents/:documentId        → Document Details
```

---

## Document Library ⏳

Implemented:

- Document listing from `GET /documents`
- Client-side search across title and description
- Classification filter (`GENERAL`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`)
- Lifecycle filter select (8 statuses)
- Show-deleted toggle revealing `DELETED` rows
- Clear-filters control
- Empty and error states with retry
- Lifecycle status badges
- Classification display
- Current version display
- Last updated timestamp
- Expired-draft flag derived from `draftExpiresAt`
- Manual refresh
- Navigation to document details

Remaining:

- Fix the lifecycle filter wiring (see Known Issues)
- Display the draft expiry date, not only the expired flag
- Dashboard shortcut to the document library
- Server-side search, sorting, and pagination

---

## Draft Upload Flow ⏳

Implemented:

- Draft creation through `POST /documents/drafts` with title, description, and classification
- Redirect to the upload route after draft creation
- File selection with reusable upload and selected-file components
- Client-side validation: 25 MB maximum, PDF / TXT / DOC / DOCX by MIME type
- Upload progress driven by the Axios progress event
- Draft upload through `POST /documents/drafts/:id/upload`
- Redirect to document details after a successful upload
- Local file removal before upload

Remaining:

- Access configuration before publishing
- Review and confirmation step
- Draft expiry and status visibility on the upload page
- Replace an already uploaded file
- Delete an uploaded file (`DELETE /documents/drafts/:id/upload` exists in the API layer but is not wired)

---

## Document Details ⏳

Implemented:

- Document metadata and description
- Current lifecycle status badge
- Current version display
- Version history with per-version download
- Publish draft
- Download latest version
- Upload new version (only when `READY`)
- Upload progress and client-side validation
- Delete workflow with a dedicated confirmation dialog
- Restore workflow with a dedicated confirmation dialog
- Permanent cleanup workflow with a dedicated confirmation dialog
- Queued, processing, and failed-state messages
- Access management panel
- Access history panel
- Page-level loading, error, and action-error states
- Derived action guards: publish requires `DRAFT`; download is blocked for `DRAFT` and `PROCESSING`

Remaining:

- Real-time processing-status updates
- Draft upload actions on the details page

---

## Access Management ⏳

Implemented:

- Load access policies
- Load organization, organization units, and organization members in one parallel batch
- Policy table with subject, subject type, permission, and temporary expiry
- Grant access
- Revoke access
- Edit access policy
- Subject selection (`ORGANIZATION`, `UNIT`, `ROLE`, `USER`)
- Action selection (`QUERY`, `VIEW`, `DOWNLOAD`, `MANAGE_ACCESS`), immutable while editing
- Effect selection (`ALLOW` / `DENY`) sent as `effect`
- Unit scope selection (`UNIT_ONLY`, `UNIT_AND_DESCENDANTS`)
- Role values `OWNER`, `ADMIN`, `MANAGER`, `MEMBER`
- Temporary access with an ISO `validUntil`, `null` when permanent
- Subject-specific payload fields (`subjectOrganizationId`, `subjectUnitId`, `subjectRole`, `subjectUserId`)
- Organization name resolved from the API instead of a hardcoded label
- Member labels fall back through `fullName` → `name` → `email`
- Reason field
- Validation blocking submit for unresolved `ORGANIZATION` subjects, `UNIT` subjects without scope, and temporary access without an expiry

Remaining:

- Mirror the backend 7-day temporary-access cap and `validUntil` > `validFrom` rule in the form
- Replace the `window.confirm` revoke confirmation and the fixed `Removed from frontend` reason with a dedicated dialog and a user-supplied reason
- Field-level validation messages
- Use the existing `grantTemporaryDocumentAccess` endpoint instead of routing temporary grants through the general grant call

---

## Access History ⏳

Implemented:

- API integration with `GET /documents/:documentId/access/history`
- Read-only table
- Event type, subject, actor, timestamp, and reason columns
- Subject and actor fallbacks (`Unknown`, `System`)
- Loading, error, and empty states

Remaining:

- Display `previousState` and `newState`
- Timeline view
- Richer policy change details

---

## Deletion & Recovery ⏳

Implemented:

- Delete confirmation dialog
- Restore confirmation dialog
- Permanent cleanup dialog
- API integration
- Deleted-document view inside the library (show-deleted filter and deleted marker)

---

# Known Issues

- `DocumentFilters` declares `status` / `onStatusChange`, but `DocumentLibrary` passes `lifecycle` / `onLifecycleChange`. The lifecycle select is therefore uncontrolled, the filter never leaves `ALL`, and `Clear Filters` would call an undefined handler.
- `UploadDocument` never fetches the draft, so an expired or already-uploaded draft is not detected before the upload request.
- `axios.js` has a hardcoded `baseURL` and no response interceptor; global 401 handling does not exist and each caller reads `error.response.data.message` itself.
- `ProtectedRoute` and `PublicRoute` render `null` while the session is being verified, producing a blank frame.
- Several `document.api.js` exports are unused: `updateDocumentDraft`, `getDocumentVersionById`, `expireDocumentDrafts`, `deleteDraftUpload`, `grantTemporaryDocumentAccess`, `getDocumentDownloadUrl`.

---

# Target Workflow

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

Document lifecycle currently supports:

```text
Draft
Submitted
Queued
Processing
Ready
Failed
Deleted
```

`Configure Access` and `Review` are only reachable from the document details page after publishing, not inside the draft upload flow.

---

# Future Roadmap

| Phase | Focus |
| --- | --- |
| Phase 6 | Document Processing UI (queue status, processing progress, retry handling) |
| Phase 7 | Retrieval Interface (semantic search, citations, streaming responses) |
| Phase 8 | Search & Analytics (search history, retrieval metrics, usage analytics) |
| Phase 9 | Organization & Retrieval Settings |
| Phase 10 | UI Polish (notifications, accessibility, responsive improvements, loading skeletons) |

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
    │       │   ├── AccessHistoryRow.jsx
    │       │   ├── AccessHistoryTable.jsx
    │       │   ├── AccessPolicyForm.jsx
    │       │   ├── AccessPolicyRow.jsx
    │       │   ├── AccessPolicyTable.jsx
    │       │   ├── CleanupDocumentDialog.jsx
    │       │   ├── DeleteDocumentDialog.jsx
    │       │   ├── DocumentAccess.jsx
    │       │   ├── DocumentAccessHistory.jsx
    │       │   ├── DocumentFilters.jsx
    │       │   ├── DocumentHeader.jsx
    │       │   ├── DocumentTable.jsx
    │       │   ├── RestoreDocumentDialog.jsx
    │       │   ├── SelectedFileCard.jsx
    │       │   ├── StatusBadge.jsx
    │       │   ├── SubjectSelector.jsx
    │       │   ├── SubjectValueSelector.jsx
    │       │   └── UploadCard.jsx
    │       ├── CreateDocument.jsx
    │       ├── DocumentLibrary.jsx
    │       ├── UploadDocument.jsx
    │       └── DocumentDetails.jsx
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
Fix lifecycle filter wiring
Draft expiry date
Dashboard shortcut
Server-side search, sorting, pagination

Draft Upload
    ↓
Access configuration
Review & confirmation
Draft status and expiry
Replace/Delete uploaded file

Document Details
    ↓
Processing & failure state updates
Draft upload actions

Access Management
    ↓
Temporary-access duration validation
Dedicated revoke dialog with reason
Field-level validation messages

Access History
    ↓
previousState / newState
Timeline
```

After completing these workflows, development will continue with **Phase 6 — Document Processing UI**.

---

# Overall Progress

| Module | Progress |
| --- | --- |
| Frontend Foundation | ✅ Complete |
| Authentication | ✅ Complete |
| Dashboard | ✅ Complete |
| Organization Management | ✅ Complete |
| Access & Administration | ✅ Complete |
| Document API Layer | ✅ Complete |
| Document Library | ~85% |
| Draft Upload Flow | ~85% |
| Document Details | ~95% |
| Access Management | ~85% |
| Access History | ~50% |
| Deletion & Recovery | ~95% |

---

# Current Focus

The frontend is focused on completing the remaining document-management workflows before beginning **Phase 6 — Document Processing UI**, which will introduce real-time status updates, queue tracking, retry controls, and richer processing visualization. The document library lifecycle filter is the highest-priority defect because it is user-visible and already blocking a documented feature.
