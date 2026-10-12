# Frontend Changelog

File-level fix history for the Enterprise RAG Platform frontend.

Summary-level status lives in [`frontendDevelopmentLog.md`](frontendDevelopmentLog.md).

---

## 2026-10-12 — Document audit

- `docs/frontendDevelopmentLog.md` — restructured into: project status, completed functionality, known limitations/bugs, current phase + acceptance criteria, change history. Corrected target workflow (no pre-publish access/review steps; publish dispatches straight to processing) and lifecycle (8 statuses incl. EXPIRED). Added Phase 6 acceptance criteria, Phase 7 scope, and pre-production verification checklist.
- `docs/frontendChangelog.md` — created; file-level fix history moved here from the development log.

## 2026-10-12 — Phase 6: Document Processing UI

- **DocumentProcessingQueue.jsx** — new processing queue page (QUEUED/PROCESSING/FAILED filter, summary cards, 5 s auto-refresh toggle, search/filter, reprocess action, links to details)
- **DocumentProcessingQueue.css** — queue page styling
- **document.api.js** — added `reprocessDocument`
- **DocumentRoutes.jsx** — added `/documents/queue` route
- **Navbar.jsx** — added Processing Queue link

## 2026-10-12 — Query page

- **Query.jsx** — new `/query` page: query form with `topK` (1–20), `POST /query` execution, answer/evidence/sources display (sources link to details), previous-queries panel with `limit`/`offset` pagination and click-to-fill
- **QueryRoutes.jsx** — new `/query` route contribution
- Removed unused `historyTotal` state and unused `err` variable

## 2026-10-12 — Lint fixes and smaller fixes

- **App.jsx** — added catch-all route with new `NotFound` page (404 handling)
- **SubjectValueSelector.jsx** — removed `OWNER` role option (backend accepts only `ADMIN`, `MANAGER`, `MEMBER`)
- **DocumentAccess.jsx** — added missing `editingPolicy` state/setter and `RevokeAccessDialog` import; wrapped `loadData`, `loadAccessPolicies`, `loadOrganizationData`, `refreshData` in `useCallback` and fixed effect dependencies
- **DocumentAccessHistory.jsx** — wrapped `loadHistory` in `useCallback`, added to effect dependency array
- **Organization.jsx** — added `capacity` to effect dependency array; removed debug `console.log`
- **useOrganizationRevision.js** — wrapped `syncOrganizationRevision` and `handleCheckRevision` in `useCallback`; fixed effect dependencies
- **useOrganizationTree.js** — fixed two synchronous setState-in-effect occurrences; removed dead `expandAll`/`collapseAll` exports
- **MemberCard.jsx** — removed unused 360-line component (had `OWNER` role, never imported)
- **UploadCard.jsx** — reset file input after rejected selection (ref + value clearing) so re-picking the same file fires a change event
- **MembersPanel.jsx** — filter unit move destinations with `getValidParentType` hierarchy validation
- **useOrganizationData.js** — removed unused `clearMessages`; fixed effect
- **useOrganizationTree.js / useOrganizationData.js** — synchronous setState-in-effect fixes
- **AuthContext.jsx** — eslint-disable for react-refresh; removed unused `error` variable

## 2026-10-12 — Phase 5: Document Management UI (80 lint errors resolved)

- **DocumentDetails.jsx** — added missing imports (`DocumentHeader`, `StatusBadge`, `UploadCard`, `DocumentAccess`, `DocumentAccessHistory`, `RestoreDocumentDialog`), added `actionError` state and `setActionError`, added `handleVersionDownload`, fixed recursive `loadDocument` call, fixed effect dependencies, added unmount cleanup flag
- **DocumentLibrary.jsx** — `loadDocuments` wrapped in `useCallback`; effect dependency fixed
- **UploadDocument.jsx** — added missing state declarations (`loading`, `document`, `selectedFile`, `uploading`, `uploadProgress`, `removing`) and their setters
- **AccessPolicyForm.jsx** — subject/state initialization effects restructured as named async initializer functions; added field-level `formError` validation messages
- **DocumentAccess.jsx / DocumentAccessHistory.jsx** — see lint fixes above
- **routes/index.js** — fixed broken export to use named export
- **Home.jsx** — replaced nested `<main>` with `<div>`
- **Register.jsx** — removed redundant `localStorage.setItem` and second `navigate` call
- **ProtectedRoute.jsx / PublicRoute.jsx** — added loading spinner UI (previously blank frame)
- **Invitations.jsx** — moved `if (!user)` check inside `try` block to fix loading hang
- **vite.config.js** — added `@api` path alias to resolve import issues in production build

## 2026-10-06 — Initial integration fixes

- **Permissions.jsx** — fixed grant-flow crash (refetch via `handleMemberSelection` and `fetchPermissionGrants`); fixed stale "My Permissions" view
- **Organization.jsx** — fixed unit/member mutations being silently discarded (real setters passed through)
- **DocumentDetails.jsx** — added `includeDeleted` parameter so details page works after soft delete
- **document.api.js** — added `includeDeleted` parameter to `getDocuments` so the deleted-document filter matches
- **DocumentAccess.jsx** — policy rows now read `effect`/`validUntil` instead of nonexistent fields
- **DocumentAccessHistory.jsx** — access-history rows fixed after backend began resolving `actorName`/`subjectName`
- **document.api.js** — fixed document download route (wrong endpoint previously)
- **MembersPanel.jsx** — member role options updated (later fully fixed in `SubjectValueSelector.jsx` on 2026-10-12)
- **AccessPolicyForm.jsx** — added UTC/local timezone helpers for datetime fields; clear `subjectId` on `subjectType` change; `resetForm` now runs after every successful submit (not only when not editing)
- **document.api.js** — temporary grants moved to `grantTemporaryDocumentAccess` endpoint
- **axios.js** — replaced hardcoded baseURL with env var; added response interceptor for 401 handling
- **DocumentHeader.jsx** — `canDownload` now blocks DELETED/EXPIRED in addition to DRAFT/PROCESSING
- **UploadDocument.jsx** — upload state resets on route change (effect keyed on `documentId`)
