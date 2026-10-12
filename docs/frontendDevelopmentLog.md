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
| Document Management UI | ✅ |

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
- Lifecycle filter select (7 statuses: DRAFT, SUBMITTED, QUEUED, PROCESSING, READY, FAILED, DELETED)
- Show-deleted toggle revealing `DELETED` rows
- Clear-filters control
- Empty and error states with retry
- Lifecycle status badges
- Classification display
- Current version display
- Last updated timestamp
- Expired-draft flag derived from `draftExpiresAt`
- Draft expiry date displayed
- Manual refresh
- Navigation to document details

- Server-side search, sorting, and pagination (deferred to future enhancement)

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
- Draft expiry and status visibility on upload page
- Replace/delete uploaded file (can remove/replace already uploaded draft file)

---

## Document Details ⏳

Implemented:

- Document metadata and description
- Current lifecycle status badge
- Current version display
- Version history with per-version download
- Publish draft (with confirmation dialog)
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
- Real-time processing status polling
- Draft upload actions on details page (remove/replace/upload)

Remaining:

---

## Access Management ✅ (field/contract fixes applied)

Implemented:

- Load access policies
- Load organization, organization units, and organization members in one parallel batch
- Policy table with subject, subject type, permission, and temporary expiry
- Grant access
- Revoke access (dedicated dialog with user-supplied reason)
- Edit access policy
- Subject selection (`ORGANIZATION`, `UNIT`, `ROLE`, `USER`)
- Action selection (`QUERY`, `VIEW`, `DOWNLOAD`, `MANAGE_ACCESS`), immutable while editing
- Effect selection (`ALLOW` / `DENY`) sent as `effect`
- Unit scope selection (`UNIT_ONLY`, `UNIT_AND_DESCENDANTS`)
- Role values `ADMIN`, `MANAGER`, `MEMBER`
- Temporary access with an ISO `validUntil`, `null` when permanent
- Subject-specific payload fields (`subjectOrganizationId`, `subjectUnitId`, `subjectRole`, `subjectUserId`)
- Organization name resolved from the API instead of a hardcoded label
- Member labels fall back through `fullName` → `name` → `email`
- Reason field
- Validation blocking submit for unresolved `ORGANIZATION` subjects, `UNIT` subjects without scope, and temporary access without an expiry

Implemented (2026-10-12):

- Revoke access with dedicated dialog and user-supplied reason
- Draft upload page shows draft info, expiry, status; supports removing/replacing uploaded file
- Document details polls status while QUEUED/PROCESSING for real-time updates
- Document table displays draft expiry date
- Dashboard has Documents quick access link

Remaining:

---

## Access History ✅ (field/contract fixes applied)

Implemented:

- API integration with `GET /documents/:documentId/access/history`
- Read-only table
- Event type, subject, actor, timestamp, and reason columns
- Subject and actor fallbacks (`Unknown`, `System`)
- Loading, error, and empty states
- `previousState` and `newState` rendering from audit records
- State Change column

Implemented (2026-10-12):

- Revoke access with dedicated dialog and user-supplied reason
- Draft upload page shows draft info, expiry, status; supports removing/replacing uploaded file
- Document details polls status while QUEUED/PROCESSING for real-time updates
- Document table displays draft expiry date
- Dashboard has Documents quick access link

Fixed (2026-10-06):

- Backend now resolves `actorName` and `subjectName` server-side, so the audit trail can identify who did what
- `AccessHistoryRow.jsx` now reads `actorName`/`subjectName` from the backend instead of nonexistent `actor?.name`/`subjectName` relations
- Added State Change column rendering `previousState` and `newState`

Remaining:

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

Found by a full read-through audit on 2026-09-30. Every item was verified by reading the code and checking the corresponding backend endpoint.

## Blocking

## Backend Contract Mismatches

## Component Contract Mismatches

## Form and State Defects

## Lower Severity

- `App.jsx:29-99` has no catch-all route, so any unknown URL renders a blank page.
- `routes/index.js:1` re-exports `default` from `DocumentRoutes.jsx`, which has no default export. Unreferenced today, so the build survives, but any import from `./routes` fails.
- `Register.jsx:32-36` calls `navigate("/")` twice around `login(token)`, implying the token is not stored by `login`.
- `Organization.jsx:98-107` logs organization load state to the console on every render.
- `Home.jsx:36` nests `<main>` inside the `<main>` in `PublicLayout.jsx:10`.
- `MemberCard.jsx` (360 lines) is never imported, and diverges from the member UI actually in use.
- Dead exports in `organization.utils.js` and the organization hooks, including expand/collapse-all helpers that imply a capability that does not exist.
- File inputs are never reset after a rejected selection, so re-picking the same file fires no change event; upload progress renders `NaN%` when `Content-Length` is absent.
- `Organization.jsx:98-107` console logging and `MembersPanel.jsx:236-262` offering unit destinations the backend rejects.
- No `dangerouslySetInnerHTML` or `innerHTML` anywhere; all user and LLM text is rendered as escaped JSX children. There is no retrieval UI yet, so the risky case does not currently exist.

## Previously Reported and Still Open

## Previously Reported and Fixed

- The lifecycle filter is now wired. `DocumentFilters` accepts `lifecycle` / `onLifecycleChange`, `DocumentLibrary` passes exactly those, `handleClearFilters` calls a defined handler, and the select is controlled. Verified as the only caller.

**Fixed (2026-10-06):**

- **Permissions page crash on grant flow** — Replaced optimistic prepend with full refetch via `handleMemberSelection` after grant; added `fetchPermissionGrants` to refresh "My Permissions" after grant/revoke.
- **Organization unit/member mutations silently discarded** — Fixed `Organization.jsx` to pass real `setOrganizationUnits` and `setOrganizationMembers` from `useOrganizationData` instead of empty functions.
- **Document details bricks after soft delete** — Added `includeDeleted` parameter to `getDocumentById`; `loadDocument` now retries with `includeDeleted=true` on 404; delete/restore/cleanup handlers pass `true` when reloading.
- **Deleted-document filter never matched** — Added `includeDeleted` parameter to `getDocuments`; `DocumentLibrary` passes `showDeleted` state; effect dependency on `showDeleted` added.
- **Access policy rows read nonexistent fields** — `AccessPolicyRow.jsx` now reads `effect`/`validUntil` and resolves subject names from loaded organization/units/members; `AccessPolicyTable.jsx` filters out revoked policies (`isActive: false`).
- **Access history rows read nonexistent fields** — Backend now resolves `actorName`/`subjectName` server-side; `AccessHistoryRow.jsx` reads these fields; `AccessHistoryTable.jsx` added State Change column with `previousState`/`newState`.
- **Document download calls wrong route** — Removed dead `getDocumentDownloadUrl`; `downloadDocument` now uses correct backend route `/:documentId/download` and `/:documentId/versions/:versionId/download`.
- **Member role options mismatch** — Updated `MembersPanel.jsx` to use backend-valid roles: `ADMIN`, `MANAGER`, `MEMBER` (removed `OWNER`).
- **AccessPolicyForm datetime UTC/local bug** — Added `utcToLocalDatetime` and `localDatetimeToUtc` helpers for proper timezone handling.
- **subjectId not cleared on subjectType change** — Added effect to clear `subjectId`, `scope`, and `formError` when `subjectType` changes.
- **resetForm only runs when not editing** — Now runs after every successful submit; clears form for both create and edit flows.
- **Validation without messages** — Added `formError` state with field-level messages; validation now checks 7-day cap and `validUntil > now`.
- **Temporary grants routed through wrong endpoint** — `DocumentAccess.jsx` now uses `grantTemporaryDocumentAccess` when `isTemporary` is true.
- **axios.js hardcoded baseURL, no 401 handling** — Added `VITE_API_BASE_URL` env var support; added response interceptor for global 401 handling (clears token, redirects to login).
- **ProtectedRoute/PublicRoute blank frame** — Added loading spinner UI (`route-loading` class in `index.css`) instead of returning `null`.
- **Register.jsx double navigate** — Removed redundant `localStorage.setItem` and second `navigate("/")`; `login()` already stores token.
- **Organization.jsx console logging** — Removed debug `console.log` from render.
- **Home.jsx nested `<main>`** — Changed `<main className="home">` to `<div className="home">` to avoid nesting inside `PublicLayout`'s `<main>`.
- **routes/index.js broken export** — Fixed export to use named export `documentRoutes` instead of non-existent default.
- **DocumentHeader canDownload blocks DELETED/EXPIRED** — Added checks for `DELETED` and `EXPIRED` statuses.
- **Upload state not reset on route change** — Added reset of `showUploadSection`, `selectedVersionFile`, `versionUploadProgress`, `actionError` in effect keyed on `documentId`.
- **Invitations.jsx loading hang** — Moved `if(!user)` check inside `try` block so `finally` always runs and clears loading.
- **useOrganizationRevision stale snapshot** — Fixed `handleRefreshOrganizationChanges` to set revision only after mismatch check; added `setCheckingRevision(false)` in mismatch branch.
- **Permissions.jsx My Permissions stale** — Added `fetchPermissionGrants` and call it after grant and revoke.

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
    │       │   ├── PublishConfirmationDialog.jsx
    │       │   ├── PublishConfirmationDialog.jsx\n    │       │   ├── RevokeAccessDialog.jsx
    │       │   ├── PublishConfirmationDialog.jsx
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

## Phase 5 Complete — Move to Phase 6

All Phase 5 items are complete:

- Document Library
- Draft Upload Flow
- Document Details
- Access Management
- Access History
- Deletion & Recovery
- Query

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
| Document Library | Complete |
| Draft Upload Flow | Complete |
| Document Details | Complete |
| Access Management | Complete |
| Access History | Complete |
| Deletion & Recovery | Complete |
| Query | Complete |

---

# Current Focus

The frontend has resolved all blocking issues and major contract mismatches identified in the 2026-09-30 audit. Phase 5 is complete.

After completing these workflows, development will continue with **Phase 6 — Document Processing UI**.

---

# Query Page

Implemented (2026-10-12):

- New `/query` route contributed via `src/routes/QueryRoutes.jsx`
- Query form with textarea and `topK` (1–20) input
- POST `/query` execution with loading and error states
- Answer, evidence, and sources display (sources link to document details)
- Previous queries panel using `GET /query/history` with `limit`/`offset` pagination
- Click-to-fill previous query into the input field
- Backend can return non-text data (evidence/sources) rendered as JSON and document links
