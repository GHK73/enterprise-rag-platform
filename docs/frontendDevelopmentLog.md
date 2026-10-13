# Frontend Development Log

Implementation progress for the Enterprise RAG Platform frontend.

- Architecture and standards: `docs/frontendDevelopment.md`
- Backend reference: `docs/DEVELOPMENT.md`
- File-level fix history: `docs/frontendChangelog.md`

## 1. Current Project Status

**Active Phase:** Phase 7 — Retrieval Interface (multi-chunk-type support complete) · **Next:** Phase 8 — Search & Analytics

| Module | Status |
| --- | --- |
| Frontend Foundation (axios instance, API wrapper, protected routes, AuthContext) | ✅ |
| Authentication (login, register, session verification via `GET /auth/me`) | ✅ |
| Dashboard | ✅ |
| Organization Management (units, members, capacity, tree) | ✅ |
| Access & Administration UI (permissions, invitations) | ✅ |
| Phase 5 — Document Management UI (library, draft upload, details, access policies, access history, deletion/recovery) | ✅ |
| Phase 6 — Document Processing UI (processing queue, reprocess) | ✅ |
| Query Interface (basic) | ✅ |
| Phase 7 — Multi-chunk-type Retrieval (tables, formulas, figures, code, text) | ✅ |

**Verification status (2026-10-13):**

| Check | Result |
| --- | --- |
| `npm run lint` (frontend) | ✅ 0 errors, 0 warnings — verified by execution |
| `npm run build` (frontend) | ✅ Succeeds (156 modules) — verified by execution |
| Backend tests | ✅ 57/57 pass — verified by execution |
| Automated tests | ❌ None exist — frontend has no test runner |
| Runtime / integration / E2E verification | ❌ Not performed — see checklist in §4.5 |

Lint and build success do **not** establish that API integration, authorization, processing, or recovery flows work. Features are verified by code inspection only until the §4.5 checklist is executed.

### Local Setup

```bash
cd frontend
npm install
npm run dev
```

### Routes

```text
/documents                    → Document Library
/documents/new                → Create Draft
/documents/:documentId/upload → Upload Draft File
/documents/:documentId        → Document Details
/documents/queue              → Processing Queue
/query                        → Query Interface
```

## 2. Completed Functionality

**Document Library** — listing from `GET /documents` (all documents the user can VIEW); client-side search across title and description; classification filter; lifecycle filter (7 selectable statuses; `StatusBadge` renders all 8 incl. EXPIRED, which is not filterable because the backend excludes EXPIRED from `GET /documents`); show-deleted toggle (`includeDeleted=true`); empty/error/loading states with retry and manual refresh; status badges, classification, current version, last-updated timestamp, draft-expiry display.

**Draft Upload Flow** — draft creation via `POST /documents/drafts` (title, description, classification) → navigate to upload route; reusable `UploadCard`/`SelectedFileCard` components; client-side validation (25 MB maximum; PDF/TXT/DOC/DOCX by MIME — **see bug 1: DOC is rejected by the backend**); Axios upload progress; remove/replace uploaded file (`DELETE /documents/drafts/:id/upload`); draft status and expiry shown on the upload page.

**Document Details** — metadata, lifecycle status badge, current version, version history with per-version download; publish with confirmation dialog (button rendered only for DRAFT); download latest version (blocked for DRAFT, PROCESSING, DELETED, EXPIRED); upload new version only when READY; delete (soft), restore, and permanent-cleanup workflows with confirmation dialogs; access management panel and read-only access-history panel; processing status polling at 3-second intervals that **stops** at terminal states (READY, FAILED, DELETED, EXPIRED) with effect cleanup on unmount/route change; derived action guards.

**Access Management** — policy table with subject, subject type, action, effect, scope, temporary expiry; grant/edit/revoke (revoke requires a user-supplied reason); subject selection (`ORGANIZATION`, `UNIT`, `ROLE`, `USER`; roles `ADMIN`, `OWNER`, `MANAGER`, `MEMBER`); actions `QUERY`, `VIEW`, `DOWNLOAD`, `MANAGE_ACCESS` (immutable while editing); effects `ALLOW`/`DENY`; unit scope `UNIT_ONLY`/`UNIT_AND_DESCENDANTS`; temporary access with ISO `validUntil` (client enforces max 7 days, matching backend `MAX_TEMPORARY_ACCESS_DAYS = 7`); validation blocks submit for unresolved ORGANIZATION subjects, UNIT subjects without scope, and temporary access without expiry. The payload matches the backend access-policy model exactly.

**Access History** — read-only audit table from `GET /documents/:id/access/history`: event type, subject, actor, timestamp, reason, state changes; loading, error, and empty states.

**Deletion & Recovery** — soft delete (`DELETE /documents/:id`), restore (`PATCH /documents/:id/restore`), permanent cleanup (`DELETE /documents/:id/cleanup`); deleted documents visible via show-deleted toggle. Backend semantics: soft delete preserves versions and policies; permanent cleanup deletes all S3 objects, versions, access policies, audit records, and the document — but does **not** remove Qdrant vectors (backend gap, §3).

**Document Processing UI (Phase 6)** — `/documents/queue` listing documents in QUEUED, PROCESSING, FAILED; summary cards (Queued/Processing/Failed counts), client-side search and lifecycle filter; auto-refresh toggle (5-second interval) plus manual refresh; reprocess button for FAILED documents (`POST /documents/:id/versions/:currentVersionId/reprocess`), guarded on `currentVersionId`; links to document details.

**Query Interface (multi-chunk-type)** — query form with textarea and `topK` (1–20); `POST /query` with loading/error states; answer display; **structured evidence panel** showing `evidence.sufficient`, `evidence.reason`, and `evidence.hasStructuredEvidence`; **typed source rendering** via `ChunkRouter` dispatching to `TableChunk` (markdown tables), `FormulaChunk` (LaTeX with rendered preview), `FigureChunk` (caption + description), `CodeChunk` (syntax-highlighted with language badge), `TextChunk` (plain text); each source shows page, score, chunk-type badge, and "View Document" link; previous-queries panel from `GET /query/history` with `limit`/`offset` pagination (limit 10) and click-to-fill.

## 3. Known Limitations and Bugs

### Bugs (frontend)

| # | Severity | Issue |
| --- | --- | --- |
| 1 | High | **DOC MIME mismatch.** `UploadDocument.jsx` and `DocumentDetails.jsx` allow `application/msword` (.doc), but the backend accepts only PDF, TXT, DOCX (`backend/src/utils/fileValidation.js`). A .doc file passes client validation and fails server upload with a 400. Fix: remove `application/msword` from frontend `ALLOWED_TYPES` (or add it to the backend allow-list deliberately). |
| 2 | Medium | **Misleading FAILED guidance.** The FAILED banner on Document Details says "upload a new version or retry later", but "Upload New Version" is disabled unless status is `READY`. Reprocess is only available on the Processing Queue page. The banner should point to the queue, or the details page should expose the reprocess action. |
| 3 | Medium | **Queue polling never terminates and refetches everything.** `DocumentProcessingQueue` refetches the entire organization document list (`GET /documents`) every 5 s and filters client-side; auto-refresh runs indefinitely while the page is open. Details-page polling (3 s) does stop at terminal states; the queue page should stop refreshing when no QUEUED/PROCESSING documents remain, and the backend should expose a filtered processing-status endpoint. |
| 4 | Low | **Query history fails silently** (empty `catch` in `loadHistory`); the panel just stays empty on error. |
| 5 | Low | **Reprocess button is visible to all queue viewers.** Authorization (`MANAGE_ACCESS`) is enforced server-side (403 for unauthorized users), so this is a UX issue only. |

### Limitations (require backend changes)

| Area | Limitation |
| --- | --- |
| Processing observability | Backend exposes no failure reason, processing stage, queue position, or progress percentage — the UI can only show status and counts. |
| Search & pagination | `GET /documents` supports no search, sort, or pagination parameters; library search is client-side only. Query history already uses server-side `limit`/`offset`, so the two interfaces have different scalability characteristics. |
| Streaming | `POST /query` returns a single JSON response; no SSE/WebSocket support exists for streaming answers. |
| Upload limits | Backend validates MIME type only — no file-size limit and no extension check. The 25 MB limit exists only in the frontend and can be bypassed by a crafted request. |
| Vector cleanup | Permanent cleanup deletes S3 objects and DB records but not Qdrant vectors, leaving orphaned embeddings. |
| Version downloads | Behavior for missing/inaccessible versions depends on backend 403/404 handling; the frontend shows the returned error message. An empty version list renders "No versions available." |

### Authorization boundary note

All sensitive operations are independently authorized server-side (`authorizeDocumentAction`, `authorizeQueryDocuments` in `backend/src/services/document/documentAccess.service.js`). Frontend action guards are UX convenience only. For the RAG flow, the backend filters retrieval candidates by QUERY policy **before** building the LLM context (`authorizeCandidates` in `backend/src/services/query/query.service.js`), so unauthorized document content must not reach the LLM. This is a backend-enforced guarantee, not a frontend one.

## 4. Current Phase and Acceptance Criteria

### 4.1 Target Workflow (corrected to match implementation)

The backend has **no review/approval step** and no pre-publish access configuration. The actual workflow:

```text
Create Draft (DRAFT)
        │
        ▼
Upload File (one file per draft)
        │
        ▼
Publish  ── DRAFT → SUBMITTED (owner-only; creates initial access policies)
        │
        ▼
Processing ── SUBMITTED → QUEUED → PROCESSING (automatic dispatch)
        │
        ▼
Ready (READY)  or  Failed (FAILED → Reprocess from queue)
        │
        ▼
Post-publish actions (from Document Details):
  • Configure Access (requires MANAGE_ACCESS)
  • Access-history review (read-only audit trail)
  • Upload new version (READY only)
  • Download (READY only)
```

- **Configure Access** is reachable only after publishing because the backend requires `MANAGE_ACCESS` on a non-draft document. It is intentionally **not** part of the pre-publish flow.
- **Review** is not an approval gate; it is the read-only access-history audit on the details page.

### 4.2 Document Lifecycle (8 statuses)

```text
DRAFT ──publish──▶ SUBMITTED ──▶ QUEUED ──▶ PROCESSING ──▶ READY
  │                                                          │
  └──auto-expire (24h)──▶ EXPIRED                ┌───────────┴───────────┐
                                                  ▼                       ▼
                                           new version               soft delete
                                           (→ QUEUED)                     │
                                                                          ▼
                                                                      DELETED
                                                                     ┌──────┴──────┐
                                                                     ▼             ▼
                                                                 restore      permanent
                                                                 (→ READY)    cleanup
```

| From | To | Trigger |
| --- | --- | --- |
| DRAFT | SUBMITTED | Publish (owner only) |
| DRAFT | EXPIRED | Automatic after 24 h (`DRAFT_EXPIRY_HOURS`) |
| SUBMITTED | QUEUED | Automatic dispatch |
| QUEUED | PROCESSING | Worker pickup |
| PROCESSING | READY / FAILED | Processing result |
| READY | QUEUED | New version upload (`MANAGE_ACCESS`) |
| READY | DELETED | Soft delete (owner only) |
| DELETED | READY | Restore (owner only) |
| DELETED | — | Permanent cleanup (owner only) |

### 4.3 Phase 6 Acceptance Criteria

| Criterion | Status | Evidence |
| --- | --- | --- |
| Processing states displayed (QUEUED/PROCESSING/FAILED) | ✅ Met | Queue page filters, summary cards, status badges |
| Retry behavior for failed processing | ✅ Met | Reprocess for FAILED current version; server enforces `MANAGE_ACCESS` |
| Polling termination at terminal states | ✅ Met (details) / ⚠️ Partial (queue) | Details: 3 s interval stops at READY/FAILED/DELETED/EXPIRED. Queue: 5 s refresh never stops (bug 3) |
| Failure messages | ⚠️ Partial | Generic "Processing failed" banner; backend exposes no `failureReason` field |
| Progress indicators (stage, percent, queue position) | ❌ Not met | Not implementable without backend support (§3 limitations) |
| Navigation back to document details | ✅ Met | Queue rows link to `/documents/:id` |
| Failure-state guidance | ❌ Not met | FAILED banner misdirects users (bug 2) |

**Phase 6 conclusion:** complete for the functionality the backend supports. The two unmet criteria require backend changes (failure-reason exposure, progress/queue-position endpoints) and are logged as limitations rather than frontend work.

### 4.4 Phase 7 Scope — Retrieval Interface (COMPLETED 2026-10-13)

**Delivered in Phase 7:**

1. **Structured evidence rendering** — replaced raw JSON dump with structured evidence panel; surfaces `evidence.sufficient`, `evidence.reason`, `evidence.hasStructuredEvidence`; explicit "insufficient evidence" state when `sufficient === false`
2. **Typed source rendering** — `ChunkRenderer` routes each source by `chunkType` to dedicated components: `TableChunk` (markdown tables, scrollable), `FormulaChunk` (LaTeX source + `$$...$$` rendered preview), `FigureChunk` (caption + description), `CodeChunk` (syntax-highlighted with language badge), `TextChunk` (plain text)
3. **Citation-ready sources** — each source displays chunk-type badge, page number, relevance score, metadata (markdown/latex/caption/language), and "View Document" link to document details
4. **Query failure UX** — error boundary for query execution; history errors no longer silent (still logged but UX preserved)

**Backend contract updated:** `POST /query` response now includes `sources[].chunkType` and `sources[].metadata`; `evidence` includes `hasStructuredEvidence` flag and `SUFFICIENT_EVIDENCE_WITH_STRUCTURED` reason.

### 4.5 Phase 8+ Scope (unchanged): Search & Analytics, Organization & Retrieval Settings, UI Polish.

### 4.6 Pre-Production Verification Checklist (not yet executed)

No automated tests exist. Before considering the frontend production-ready, manually verify and record results for:

- [ ] Draft creation → file upload → publish → processing → READY (happy path end to end)
- [ ] Draft auto-expiry after 24 h and EXPIRED handling
- [ ] Access grant/edit/revoke, including DENY precedence and temporary-access expiry
- [ ] Delete → restore → permanent cleanup; confirm version history behavior at each step
- [ ] Per-version download; behavior when a version is missing or inaccessible
- [ ] Reprocess of a FAILED document
- [ ] Query authorization: confirm a user without QUERY permission cannot retrieve content from a document (backend-enforced; verify with two accounts)
- [ ] Frontend/backend request-response format agreement on every endpoint in `document.api.js`
- [ ] **Query response contract: `sources[].chunkType`, `sources[].metadata`, `evidence.hasStructuredEvidence`**
- [ ] Fix bugs 1–3 in §3

## 5. Change History

Detailed file-level fixes are recorded in [`docs/frontendChangelog.md`](frontendChangelog.md).

| Date | Summary |
| --- | --- |
| 2026-10-06 | Initial implementation: foundation, auth, dashboard, organization management, document API layer, routes. Fixed early integration issues (permissions refetch, organization setters, access field mappings, axios baseURL/401 handling). |
| 2026-10-12 | Phase 5: resolved 80 lint errors across Document Management UI; added missing state/imports; fixed effect dependencies; removed unused `MemberCard.jsx` and dead tree helpers; fixed file-input reset and unit-move hierarchy validation. Phase 6: added Processing Queue page, reprocess API, route, and Navbar link. Added Query page (`/query`) with answer/evidence/sources and paginated history. Added 404 catch-all route. |
| 2026-10-12 | Document audit: corrected workflow and lifecycle definitions (8 statuses incl. EXPIRED; no review step; access config is post-publish), split file-level fixes into `frontendChangelog.md`, added known-limitations section, Phase 6 acceptance criteria, Phase 7 scope, and pre-production verification checklist. Verified lint (0/0) and build by execution. |
| 2026-10-13 | **Phase 7 — Multi-chunk-type Retrieval Interface:** updated AI service chunking to preserve `chunk_type` and type-specific metadata (markdown tables, LaTeX formulas, captions, code language); updated retrieval schema to include `chunk_type`; backend `contextGuard` formats typed chunks for LLM context; evidence service detects structured evidence; frontend `Query.jsx` uses `ChunkRenderer` with `TableChunk`, `FormulaChunk`, `FigureChunk`, `CodeChunk`, `TextChunk` components; updated CSS for all chunk types; verified lint (0/0), build (156 modules), backend tests (57/57). |

## Appendix: Frontend Structure

```text
frontend/
└── src/
    ├── api/
    │   ├── axios.js            # JWT interceptor, 401 handling, env baseURL
    │   └── document.api.js     # All document endpoint wrappers
    ├── components/
    │   ├── Navbar/
    │   ├── ProtectedRoute/
    │   └── PublicRoute/
    ├── context/
    │   └── AuthContext.jsx
    ├── layouts/
    │   └── PublicLayout.jsx
    ├── pages/
    │   ├── Home/ Login/ Register/ Dashboard/
    │   ├── CreateOrganization/ Invitations/ Permissions/
    │   ├── Organization/       # components/, hooks/, utils/
    │   ├── Documents/
    │   │   ├── components/     # dialogs, forms, selectors, tables
    │   │   ├── CreateDocument.jsx
    │   │   ├── DocumentLibrary.jsx
    │   │   ├── UploadDocument.jsx
    │   │   ├── DocumentDetails.jsx
    │   │   └── DocumentProcessingQueue.jsx
    │   ├── Query/
    │   │   ├── components/     # ChunkRenderer, TableChunk, FormulaChunk, FigureChunk, CodeChunk, TextChunk
    │   │   └── Query.jsx
    │   └── NotFound/
    ├── routes/
    │   ├── DocumentRoutes.jsx
    │   ├── QueryRoutes.jsx
    │   └── index.js
    ├── App.jsx
    ├── main.jsx
    └── index.css
```

## Appendix: Document API Reference (`document.api.js`)

| Function | Endpoint |
| --- | --- |
| `createDocumentDraft` | `POST /documents/drafts` |
| `updateDocumentDraft` | `PATCH /documents/:id` |
| `getDocuments` | `GET /documents` (`?includeDeleted=true`) |
| `getDocumentById` | `GET /documents/:id` (`?includeDeleted=true`) |
| `expireDocumentDrafts` | `POST /documents/cleanup/expired-drafts` |
| `uploadDraft` | `POST /documents/drafts/:id/upload` |
| `deleteDraftUpload` | `DELETE /documents/drafts/:id/upload` |
| `publishDocumentDraft` | `POST /documents/drafts/:id/publish` |
| `getDocumentVersions` | `GET /documents/:id/versions` |
| `getDocumentVersionById` | `GET /documents/:id/versions/:vid` |
| `uploadDocumentVersion` | `POST /documents/:id/versions` |
| `getDocumentAccessPolicies` | `GET /documents/:id/access` |
| `grantDocumentAccess` | `POST /documents/:id/access` |
| `updateDocumentAccessPolicy` | `PATCH /documents/access/:policyId` |
| `revokeDocumentAccess` | `DELETE /documents/access/:policyId` |
| `grantTemporaryDocumentAccess` | `POST /documents/:id/access/temporary` |
| `getDocumentAccessHistory` | `GET /documents/:id/access/history` |
| `downloadDocument` | `GET /documents/:id/download` or `GET /documents/:id/versions/:vid/download` |
| `deleteDocument` | `DELETE /documents/:id` |
| `restoreDocument` | `PATCH /documents/:id/restore` |
| `cleanupDeletedDocument` | `DELETE /documents/:id/cleanup` |
| `reprocessDocument` | `POST /documents/:id/versions/:vid/reprocess` |
