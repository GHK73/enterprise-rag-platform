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
- Lifecycle filter select (7 statuses: DRAFT, SUBMITTED, QUEUED, PROCESSING, READY, FAILED, DELETED)
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

Found by a full read-through audit on 2026-09-30. Every item was verified by reading the code and checking the corresponding backend endpoint.

## Blocking

### Permissions page crashes on the main grant flow

`Permissions.jsx:132-137` prepends the `POST /permissions` response into `memberPermissionGrants` when the grant targets the selected member. The backend returns a bare `permissionGrant.create` result with no `include` (`permission.service.js:175-179`), so the object has only `scopeUnitId` and `grantedById`.

The render then evaluates `permissionGrant.scopeUnit.name` and `permissionGrant.grantedBy.fullName` (`:437`, `:445`). Because `scopeUnit` is undefined, this throws during render and React unmounts the tree — a white screen. It fires on the normal "grant a permission to the selected member" path.

### All organization unit and member mutations are silently discarded

`Organization.jsx:118-119` passes `setOrganizationUnits: () => {}`, and `:146-147` passes `setOrganizationMembers: () => {}`, discarding the real setters from `useOrganizationData`. The `onSuccess` callback is `revision.syncOrganizationRevision`, which only re-reads `GET /organization/revision` and never refetches units or members.

Every optimistic update in the unit CRUD, unit move, and member hooks therefore does nothing. The user sees "DEPARTMENT created successfully", the tree does not change, and because `syncOrganizationRevision` sets both revisions equal, `hasOrganizationUpdates` stays false so no refresh prompt appears either. Only a full page reload recovers. Unit create, rename, delete, move, and member role/move/remove are all affected.

### Document details bricks after a soft delete

`DocumentDetails.jsx:444-473` gates the Restore and Delete Forever controls on `document.status === "DELETED"`, but `getDocumentById` resolves through `getActiveDocument`, which throws 404 when `isDeleted` is true (`documentHelpers.js:45-50`). `handleDelete` then reloads the document, gets a 404, and renders the `pageError` branch.

The delete/restore/cleanup lifecycle is unreachable through the UI. This also contradicts the "show deleted" library feature below.

## Backend Contract Mismatches

### `currentVersion` is never returned

`DocumentTable.jsx:109-112` and `DocumentDetails.jsx:542-545, 671-678` read `document.currentVersion?.versionNumber` and `.id`, but `currentVersion` is a Prisma relation, and `getDocuments` (`documentLifecycle.service.js:332`) and `getDocument` (`documentHelpers.js:30`) query without `include: { currentVersion }`.

The Version column always renders `-`, "Current Version" always renders `-`, and the "Current" badge in the version table never appears. The optional chaining prevents a crash, which is why this has gone unnoticed.

### The deleted-document filter can never match

`DocumentFilters.jsx:101-103` offers a `DELETED` lifecycle option and `:112-125` a "Show Deleted" checkbox, and `DocumentLibrary.jsx:94-97` filters on `document.status !== "DELETED"`. But `GET /documents` hardcodes `where: { isDeleted: false }`.

Both controls are dead and can only produce the empty state, while appearing functional.

### Access policy rows read fields that do not exist

`AccessPolicyRow.jsx` reads `policy.permission`, `policy.expiresAt`, `policy.subjectName`, `policy.subjectUser?.name`, and `policy.subjectUnit?.name`. `DocumentAccessPolicy` has `effect`, `validUntil`, `subjectUserId`, `subjectUnitId`, and `subjectRole`, and `getDocumentAccessPolicies` issues no relation includes.

Result: the permission column is always empty and always styled as DENY, the expiry column always reads "Permanent" even for time-limited grants, and the subject column reads "Unknown" for every USER, UNIT, and ORGANIZATION policy. Only ROLE policies resolve.

### Access history rows read fields that do not exist

`AccessHistoryRow.jsx:4-14` reads `entry.actor?.name`, `entry.actorName`, and `entry.subjectName`. `DocumentAccessAudit` has `actorId`, `subjectUserId`, and `subjectUnitId`, with no includes requested.

Actor always renders "System" and Subject always renders "Unknown". An access audit trail that cannot identify who did what is a security defect, not a cosmetic one.

### Document download calls a non-existent route

`document.api.js:233-241` requests `GET /documents/:documentId/download-url`. The backend route is `GET /:documentId/download` (`document.routes.js:147-151`). Currently only dead code, so nothing breaks yet, but it will 404 as soon as it is wired up.

### Member role options do not match the backend

`MembersPanel.jsx:143-153` offers `OWNER`, `ADMIN`, `MEMBER`. The backend `validRoles` are `ADMIN`, `MANAGER`, `MEMBER` (`organization.service.js:522-530`).

Selecting `OWNER` always fails with 400 "Invalid member role", and `MANAGER` — a valid role — has no option, so editing a manager renders a select with no matching value.

## Component Contract Mismatches

### Unit creation is unreachable

`OrganizationCreateForm` is rendered only inside the `if (!organization)` branch (`Organization.jsx:226-278`), so once an organization exists it is gone. `OrganizationDetails` receives `name`, `setName`, and `handleCreateUnit` from the parent but does not destructure them, and renders `{children}` which the parent never supplies.

The same class of bug as the fixed `DocumentFilters` issue, in the opposite direction: the parent passes props the child does not declare.

### The organization form swallows API errors

`Organization.jsx:266-272` passes `error` and `message` to `OrganizationCreateForm`, which declares neither. On the only screen where it renders, unit-creation failures are never shown. Combined with a "Select Parent" button disabled whenever `childType` is empty and no error display, the screen is a dead end with no explanation.

### Organization header never receives its handlers

`Organization.jsx:285-307` passes `revision`, `latestRevision`, `checkingRevision`, and `handleCheckRevision`; `OrganizationHeader.jsx:3` declares only `organization`. The manual "check for updates" control does not exist — only the 60-second interval and the `visibilitychange` listener ever fire it.

## Form and State Defects

- **`AccessPolicyForm.jsx:85-99`** hydrates the `datetime-local` input with `new Date(validUntil).toISOString().slice(0,16)`, a UTC string the input then reads as local time. Editing an expiring policy displays a shifted time, and re-saving writes a different `validUntil`.
- **`AccessPolicyForm.jsx:54-60, 180-199`** never clears `subjectId` when `subjectType` changes. Switching from USER to ROLE sends a user id as `subjectRole` (500); switching to UNIT sends a user id as `subjectUnitId` (400).
- **`AccessPolicyForm.jsx:109-118, 205-207`** `resetForm` only runs when not editing. After a successful edit the parent clears `editingPolicy`, so the hydration effect early-returns and the form keeps the old values; the next "Grant Access" silently resubmits them.
- **`AccessPolicyForm.jsx:125-153`** four validation guards return with no message and no field-level error, so a rejected submit looks like nothing happened.
- **`AccessPolicyForm.jsx`** does not mirror the backend 7-day temporary-access cap or the `validUntil > validFrom` rule, and always routes temporary grants through the general grant call instead of `grantTemporaryDocumentAccess`.
- **`DocumentAccess.jsx:58-60, 96-100`** swallows all errors into empty defaults, so `loadData`'s catch can never fire. A 403 or 404 renders "No Access Policies" and a silently broken subject selector, and `organization` stays null, so ORGANIZATION grants are refused with no explanation.
- **`AccessPolicyTable.jsx:48-55`** renders every policy returned, including revoked ones, because the backend does not filter on `isActive`. Revoked policies appear active with live Edit and Delete buttons that return 400.
- **`DocumentDetails.jsx:57-58, 391-395`** the effect keys only on `documentId`, but upload state (`showUploadSection`, `selectedVersionFile`, progress, action error) is never reset. React Router reuses the element across `/documents/:a` → `/documents/:b`, so a file picked for one document can be uploaded to another.
- **`Invitations.jsx:31-34`** `if(!user){ return; }` returns before the `try`, so the `finally` that clears `loading` never runs. If the context has a token but no user yet, the page hangs on "Loading invitations..." permanently.
- **`useOrganizationRevision.js:133-155`** `setOrganizationRevision` runs before the mismatch check, so the stale-snapshot branch has already advanced the local revision. The "reject inconsistent snapshots" intent is not upheld.
- **`Permissions.jsx:190-196`** `permissionGrants` is never refreshed after a grant, and a revoke only patches `memberPermissionGrants`, so a revoked permission still shows as Active in "My Permissions".
- **`DocumentTable.jsx:13-25, 74-79`** `isExpiredDraft` and the `EXPIRED` badge can never be true: `getDocuments` first flips overdue drafts to `EXPIRED` and then excludes that status. The expired-draft flag is implemented but unreachable.
- **`DocumentHeader.jsx:12-15`** `canDownload` blocks only `DRAFT` and `PROCESSING`, so `DELETED` and `EXPIRED` documents offer a Download button that 404s.

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

- `axios.js` has a hardcoded `baseURL` (`http://localhost:5000/api/v1`) and no response interceptor, so there is no global 401 handling, token refresh, or automatic logout. Every caller reads `error.response.data.message` itself.
- `ProtectedRoute` and `PublicRoute` render `null` while the session is being verified, producing a blank frame.
- `UploadDocument` never fetches the draft, so an expired or already-uploaded draft is not detected before the upload request.
- Unused `document.api.js` exports: `updateDocumentDraft`, `getDocumentVersionById`, `expireDocumentDrafts`, `deleteDraftUpload`, `grantTemporaryDocumentAccess`, `getDocumentDownloadUrl`. The last one also targets a route that does not exist.
- Access policy revocation still uses `window.confirm` with the fixed reason "Removed from frontend", and the dashboard has no shortcut to the document library.

## Previously Reported and Fixed

- The lifecycle filter is now wired. `DocumentFilters` accepts `lifecycle` / `onLifecycleChange`, `DocumentLibrary` passes exactly those, `handleClearFilters` calls a defined handler, and the select is controlled. Verified as the only caller.

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
| Document Library | ~90% |
| Draft Upload Flow | ~85% |
| Document Details | ~95% |
| Access Management | ~85% |
| Access History | ~50% |
| Deletion & Recovery | ~95% |

---

# Current Focus

The frontend is focused on completing the remaining document-management workflows before beginning **Phase 6 — Document Processing UI**, which will introduce real-time status updates, queue tracking, retry controls, and richer processing visualization. The highest-priority remaining defects are the missing draft-status check before upload and the blank frame rendered by the route guards while the session is verified.

A retry control for `FAILED` documents also depends on backend work: `reprocessDocument` exists as a service and controller but has no registered route, so there is no endpoint for the UI to call yet.
