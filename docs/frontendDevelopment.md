# Frontend Architecture & Development Guide

Architecture, development standards, UI rules, and implementation workflow for the Enterprise RAG Platform frontend.

Progress and status: `docs/frontendDevelopmentLog.md` · File-level fix history: `docs/frontendChangelog.md`

## 1. Core Principles

Professional, maintainable, responsive, consistent. Build reusable components only when reuse is needed; keep pages focused; avoid unnecessary files and abstractions; modify 2–3 related files or functions at a time; test each step before continuing; do not rename working variables or restructure working code without a clear need; complete the current feature before starting another.

## 2. Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | React |
| Build Tool | Vite |
| Routing | React Router DOM |
| HTTP Client | Axios |
| State Management | React Context API |
| Styling | Component-based CSS |

## 3. Project Structure

```text
frontend/src/
├── api/          # axios.js, document.api.js
├── assets/
├── components/   # Navbar/, ProtectedRoute/, PublicRoute/
├── context/      # AuthContext.jsx
├── layouts/      # PublicLayout.jsx
├── pages/        # Home/ Login/ Register/ Dashboard/
│                 # CreateOrganization/ Invitations/ Permissions/
│                 # Organization/ Documents/ Query/ NotFound/
├── routes/       # DocumentRoutes.jsx, QueryRoutes.jsx, index.js
├── App.jsx
├── main.jsx
└── index.css
```

Create files and folders only when required. No empty folders, placeholder pages, or speculative abstractions.

## 4. Styling Standards

Every page and reusable visual component keeps its styles in a corresponding CSS file. `index.css` holds only global styling: reset, font imports, CSS variables, global typography, element defaults, scrollbar styling.

Use: `rem` for typography/spacing/radius; `%`, `vw`, `vh`, `min()`, `max()`, `clamp()` for responsive sizing; Flexbox and CSS Grid; existing CSS variables; `1px` only for fixed borders.

Avoid: inline styles, unnecessary fixed dimensions, repeated color values, duplicate global styles, page-specific styles in `index.css`.

## 5. Design System

```text
Primary #2563EB   Secondary #1E293B   Background #F8FAFC
Card #FFFFFF      Border #E2E8F0      Success #22C55E
Warning #F59E0B   Error #EF4444       Primary Text #0F172A
Secondary Text #64748B
```

Keep these as CSS variables. Font: Inter, fallback sans-serif. Typography, spacing, controls, cards, status indicators, and error states stay visually consistent.

## 6. Layout Architecture

**Public layout** — Navbar + main content, used for Home, Login, Register. The Navbar responds to authentication state: logged out shows Login/Register; logged in shows application navigation and Logout.

**Application layout** — protected pages share navigation and content structure. The current implementation uses `PublicLayout` for both public and protected branches (it supplies the shared Navbar and page outlet); a separate `ApplicationLayout` has not been introduced. Current protected areas: Dashboard, Organization, Permissions, Invitations, Documents. Future: Retrieval, Analytics, Settings.

## 7. Navigation Rules

Navigation must stay consistent across protected pages, reflect authentication state immediately, hide unavailable actions, preserve active-page state, and work on mobile and desktop. Future items are not added before their features exist.

`Navbar` is the only shared navigation component, rendered by `PublicLayout`. Authenticated links: Dashboard `/dashboard`, Organization `/organization`, Documents `/documents`, Permissions `/permissions`, Invitations `/invitations`. The logo links to `/dashboard` when authenticated, `/` otherwise. A hamburger toggle controls the mobile menu; every link closes it on click. Logout clears the session and navigates to `/`. `/documents/new` is reachable from the document library only.

## 8. Component Guidelines

Create a reusable component only when the same UI pattern appears in multiple places, the component has an independent responsibility, and reuse removes meaningful duplication. Reusable components accept data and callbacks through props, avoid page-specific business logic and direct API calls, keep styles in their own CSS file, and stay focused. Candidates: Button, Input, Modal, Loader, Badge, EmptyState — do not create them before actual reuse is required.

Pages may fetch page-specific data, manage page-specific state, coordinate API calls, compose reusable components, and handle page-level loading and errors. Pages must not duplicate global authentication logic, construct backend base URLs, contain unrelated feature logic, or create abstractions for hypothetical future use.

## 9. API Integration

All backend requests use the shared Axios configuration `src/api/axios.js` (`baseURL` from `import.meta.env.VITE_API_BASE_URL` with a fallback to `http://localhost:5000/api/v1`). A request interceptor reads `localStorage.token` and attaches `Authorization: Bearer <token>`. A response interceptor catches HTTP 401 responses, clears the token from `localStorage`, and redirects to `/login`; there is no token refresh. Every caller reads `error?.response?.data?.message`. Feature wrappers such as `src/api/document.api.js` own endpoint paths and unwrap `response.data.data`, so pages never touch Axios directly.

Rules: do not construct base URLs in pages or components; protected requests must use the stored JWT; invalid authentication must clear the session; show backend validation messages when useful; keep API logic out of reusable visual components; avoid duplicate request logic when an API function already exists.

## 10. Authentication

```text
Register / Login → Receive JWT → Store Token → Verify Session
→ Update Authentication Context → Access Protected Routes
```

`AuthContext` is the only authentication state container: state `token, user, loading`; storage `localStorage` key `"token"`; exposed `token, user, loading, login, logout, refreshUser`. `login(token)` writes the token and updates context. On every `token` change, a session verification effect calls `GET /auth/me`; a failed verification calls `logout()`. `ProtectedRoute` shows a loading spinner while the session is being verified, then redirects to `/login` when no token exists. `PublicRoute` shows a loading spinner while loading, then redirects authenticated users to `/`. A global 401 response interceptor (in `axios.js`) also clears the session and redirects to `/login` on any 401 from the backend.

## 11. Route Strategy

- **Public:** `/`
- **Authentication:** `/login`, `/register` (authenticated users are redirected away)
- **Protected:** `/dashboard`, `/organization`, `/create-organization`, `/permissions`, `/invitations`, `/documents`, `/documents/new`, `/documents/:documentId/upload`, `/documents/:documentId`, `/documents/queue`, `/query`

`App.jsx` declares public and protected branches directly; document routes are contributed as a `documentRoutes` fragment from `src/routes/DocumentRoutes.jsx`. Retrieval, analytics, and settings routes are added only when their implementation begins.

## 12. State Management

React Context only for state genuinely shared across multiple areas. Current global responsibility: Authentication Context (user, session, authentication state). Page-specific state stays local. Avoid additional global state libraries unless the existing architecture creates a real limitation.

**Multi-user synchronization** — organization state uses backend revisions for stale-state detection: load state → store revision → check latest revision; same revision means no action, new revision means fetch a consistent snapshot and update local state. Local mutations increment the backend revision, update local state, and synchronize the local revision. Avoid unnecessary full-page reloads, preserve valid user selections after refresh, reject inconsistent snapshots, prevent duplicate concurrent refreshes, and do not show false update notifications for local mutations.

## 13. Document Management UI

Document management is the complete lifecycle — library, draft upload, metadata, classification, access configuration, publication, versions, access management, history, deletion — not split into unrelated upload and document phases.

**Draft upload flow:** Select File → Validate File → Upload Draft → Configure Metadata → Select Classification → Configure Access → Review → Publish.

The UI distinguishes `DRAFT ≠ SUBMITTED ≠ QUEUED ≠ PROCESSING ≠ READY ≠ FAILED ≠ EXPIRED ≠ DELETED`. Lifecycle transitions are authoritative in the backend (`docs/DATABASE.md` — Document Lifecycle); the frontend displays state but never decides transitions. An unpublished draft expires after 24 hours (`EXPIRED`); the backend rejects expired documents with 404.

**Routes:** `/documents` (library), `/documents/new` (create), `/documents/:documentId/upload` (upload), `/documents/:documentId` (details), `/documents/queue` (processing queue).

The library fetches the full document list once from `GET /documents` and filters entirely on the client (no pagination, server-side search, or sorting). Filter state: `search` (title/description), `classification` (ALL/GENERAL/INTERNAL/CONFIDENTIAL/RESTRICTED), `lifecycle` (7 selectable statuses; EXPIRED is rendered but not filterable — the backend excludes it anyway), `showDeleted`.

Document details branches on status: DRAFT → publish allowed, download blocked; QUEUED/PROCESSING → informational banner, download blocked; FAILED → error banner; READY → download and new-version upload allowed; DELETED → restore and permanent cleanup. Upload rules enforced client-side: 25 MB maximum; MIME types `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (**note: `.doc` is rejected by the backend — see bug 1 in the development log**). Progress comes from the Axios `onUploadProgress` event.

## 14. Document Access UI

Access is separate from administrative permission management. Subjects `ORGANIZATION`, `UNIT`, `ROLE`, `USER`; actions `QUERY`, `VIEW`, `DOWNLOAD`, `MANAGE_ACCESS`.

**Access policy payload contract:**

```json
{
    "subjectType": "ORGANIZATION | UNIT | ROLE | USER",
    "action": "QUERY | VIEW | DOWNLOAD | MANAGE_ACCESS",
    "effect": "ALLOW | DENY",
    "scope": "UNIT_ONLY | UNIT_AND_DESCENDANTS",
    "validUntil": "ISO timestamp, or null for permanent access",
    "reason": "...",
    "subjectOrganizationId": "when subjectType = ORGANIZATION",
    "subjectUnitId": "when subjectType = UNIT",
    "subjectRole": "when subjectType = ROLE",
    "subjectUserId": "when subjectType = USER"
}
```

Only the field matching `subjectType` is sent; `subjectOrganizationId` comes from the loaded organization; `scope` is sent only for `UNIT` subjects; `validUntil` is `null` (not omitted) for permanent access; `effect` is the submit field name (`permission` is only the form label). Validation blocks submit for an unresolved ORGANIZATION subject or a UNIT subject without scope. Editing hydrates `action`, `scope`, and `subjectOrganizationId` from the loaded policy; the action is immutable while editing.

Subject inputs: ORGANIZATION → disabled input showing the organization name; UNIT → unit select + scope select; ROLE → select with OWNER/ADMIN/MANAGER/MEMBER; USER → member select. Temporary access is a checkbox plus `datetime-local` converted to ISO `validUntil`. Server-side rules the frontend does not yet mirror: `validFrom` is not sent (backend defaults it), the backend rejects `validUntil <= validFrom` and caps temporary access at 7 days, and `grantedById` comes from the session.

The policy table lists subject, type, permission, and temporary expiry, with edit and delete actions. Revoke currently uses `window.confirm` with the fixed reason `Removed from frontend`; new confirmation components should replace `window.confirm` as flows are added.

**Document action guards** are derived from lifecycle state, not checked inline: `canPublish = status === DRAFT && !publishing`; `canDownload = !downloading && status !== DRAFT && status !== PROCESSING`.

## 15. Access History UI

Access history is append-only. The frontend renders a read-only table: Event → `entry.eventType`; Subject → `subjectName → subjectUser.name → subjectUnit.name → subjectRole → "Unknown"`; Actor → `actor.name → actorName → "System"`; Date → `createdAt` via `toLocaleString()`; Reason → `reason` or `"-"`. No edit or delete operations for audit records. Not yet displayed: `previousState`/`newState` and a timeline presentation.

## 16. Loading, Empty, and Error States

Every data-driven interface handles loading, empty, success, validation error, permission error, and server error. Do not show blank pages while loading; empty states should explain what the user can do next; permission errors should not appear as generic failures; preserve backend validation messages; destructive actions require clear confirmation. Known deviation: `ProtectedRoute` and `PublicRoute` show a loading spinner while the session is being verified; the spinner is a static "Loading..." text rather than a branded progress indicator.

## 17. Responsive Design

Every new page is tested for desktop, tablet, and mobile. Avoid horizontal page overflow; allow large panels to scroll within controlled boundaries; keep important actions accessible; stack layouts when horizontal space is insufficient; preserve readable text widths; avoid fixed heights unless required. Responsive behavior is designed during implementation, not postponed to final polish.

## 18. Query Interface (Phase 7)

The Query page (`/query`) implements the retrieval interface with multi-chunk-type support.

**Query Form** — textarea input with `topK` selector (1–20); submits `POST /query` with loading/error states.

**Answer Display** — renders the LLM-generated answer with syntax-preserving whitespace.

**Structured Evidence Panel** — replaces raw JSON with a structured badge showing:
- `evidence.sufficient` (✓ Sufficient / ✗ Insufficient)
- `evidence.reason` (e.g., `SUFFICIENT_EVIDENCE_WITH_STRUCTURED`, `NO_AUTHORIZED_EVIDENCE`, `LOW_RELEVANCE`)
- `evidence.hasStructuredEvidence` flag when tables, formulas, or code chunks are present

**Typed Source Rendering** — each source in `result.sources` includes `chunkType` and `metadata`; the `ChunkRenderer` routes to type-specific components:
- **TableChunk** — markdown table rendered as scrollable HTML table; shows headers, rows
- **FormulaChunk** — LaTeX source display + `$$...$$` rendered preview (requires KaTeX/MathJax integration)
- **FigureChunk** / **ImageChunk** — caption + description
- **CodeChunk** — syntax-highlighted code block with language badge
- **TextChunk** — plain text with preserved whitespace

Each source shows: chunk-type badge, page number, relevance score, metadata preview, and "View Document" link to `/documents/:documentId`.

**Query History** — paginated panel from `GET /query/history` (limit 10, offset-based); click-to-fill previous queries; loading/error/empty states.

**API Response Contract** (updated for Phase 7):
```json
{
  "answer": "...",
  "sources": [
    {
      "index": 1,
      "chunkId": "uuid",
      "documentId": "uuid",
      "versionId": "uuid",
      "pageNumber": 3,
      "score": 0.87,
      "chunkType": "table",
      "metadata": { "markdown": "...", "headers": ["A","B"], "rows": [["1","2"]] }
    }
  ],
  "evidence": { "sufficient": true, "reason": "SUFFICIENT_EVIDENCE_WITH_STRUCTURED", "hasStructuredEvidence": true },
  "usedLLM": true,
  "outputGuardPassed": true
}
```

## 19. Development Workflow

Each step modifies only 2–3 related files or functions: Implement → Test → Fix Issues → Update Development Log → Continue. Do not skip testing, combine unrelated features, add unnecessary files, rename working variables without a reason, or restructure stable code unnecessarily; finish the current step before the next.

**Implementation order** follows backend readiness: Backend Feature Ready → Confirm API Contract → Add Frontend API Integration → Build UI → Test Success Cases → Test Validation and Permission Errors → Test Responsive Behavior → Update Development Log. Do not build UI against speculative API contracts.

**Coding standards:** keep components small and focused; reuse existing components when meaningful; avoid duplicate code; follow existing naming conventions; keep styles isolated; keep API logic out of reusable visual components; add abstractions only when current code requires them; test every feature before continuing.

## 20. Documentation Boundaries

This guide defines frontend architecture, development standards, UI rules, and implementation workflow. The development log defines completed work, current progress, planned features, and the next step. `docs/DATABASE.md` defines database architecture, document models, access models, and storage relationships. The backend log defines backend progress and current phase. Avoid duplicating detailed architecture or progress across these documents.

## Project Philosophy

The frontend should resemble a modern enterprise SaaS application rather than an academic project. Every interface answers: Is the feature easy to understand? Is it consistent with the rest of the application? Can it be extended without unnecessary restructuring? The goal is a professional frontend that supports secure organization management, document workflows, and permission-aware enterprise knowledge retrieval.
