# Frontend Architecture & Development Guide

Architecture, development standards, UI rules, and implementation workflow for the Enterprise RAG Platform frontend.

---

# 1. Core Principles

The frontend should be professional, maintainable, responsive, and consistent.

Development rules:

* Build reusable components only when reuse is needed.
* Keep pages focused on their own responsibilities.
* Avoid unnecessary files and abstractions.
* Modify only 2–3 related files or functions at a time.
* Test each step before continuing.
* Do not rename working variables unnecessarily.
* Do not restructure working code without a clear need.
* Complete the current feature before starting another.

---

# 2. Technology Stack

| Layer            | Technology          |
| ---------------- | ------------------- |
| Framework        | React               |
| Build Tool       | Vite                |
| Routing          | React Router DOM    |
| HTTP Client      | Axios               |
| State Management | React Context API   |
| Styling          | Component-based CSS |

---

# 3. Project Structure

Create files and folders only when required.

```text
frontend/
└── src/
    ├── api/
    ├── assets/
    ├── components/
    ├── context/
    ├── layouts/
    ├── pages/
    ├── App.jsx
    ├── main.jsx
    └── index.css
```

Current page structure:

```text
pages/
├── CreateOrganization/
├── Dashboard/
├── Home/
├── Invitations/
├── Login/
├── Organization/
├── Permissions/
└── Register/
```

Future pages should be added only when their implementation begins.

Do not create empty folders, placeholder pages, or speculative abstractions.

---

# 4. Styling Standards

Every page and reusable visual component should keep its styles in a corresponding CSS file.

```text
Login/
├── Login.jsx
└── Login.css

Navbar/
├── Navbar.jsx
└── Navbar.css
```

`index.css` should contain only global styling:

* CSS reset
* Font imports
* CSS variables
* Global typography
* Global element defaults
* Scrollbar styling

Use:

* `rem` for typography, spacing, and border radius
* `%`, `vw`, `vh`, `min()`, `max()`, and `clamp()` for responsive sizing
* Flexbox and CSS Grid for layouts
* Existing CSS variables for colors
* `1px` only where fixed borders are required

Avoid:

* Inline styles
* Unnecessary fixed dimensions
* Repeated color values
* Duplicate global styles
* Page-specific styles in `index.css`

---

# 5. Design System

## Colors

```text
Primary        → #2563EB
Secondary      → #1E293B
Background     → #F8FAFC
Card           → #FFFFFF
Border         → #E2E8F0
Success        → #22C55E
Warning        → #F59E0B
Error          → #EF4444
Primary Text   → #0F172A
Secondary Text → #64748B
```

These values should remain CSS variables and be reused throughout the application.

## Typography

```text
Primary Font → Inter
Fallback     → sans-serif
```

Typography, spacing, controls, cards, status indicators, and error states should remain visually consistent across pages.

---

# 6. Layout Architecture

## Public Layout

Used for public and authentication pages.

```text
Navbar
└── Main Content
```

Current pages include:

```text
Home
Login
Register
```

The Navbar responds to authentication state:

```text
Logged Out
→ Login
→ Register

Logged In
→ Application Navigation
→ Logout
```

## Application Layout

Protected application pages should share consistent navigation and content structure.

Current protected areas include:

```text
Dashboard
Organization
Permissions
Invitations
```

Future protected areas include:

```text
Documents
Retrieval
Analytics
Settings
```

The public landing-page interface should not be duplicated inside the authenticated workspace.

---

# 7. Navigation Rules

Navigation must:

* Remain consistent across protected pages
* Reflect authentication state immediately
* Hide unavailable actions when appropriate
* Preserve clear active-page state
* Remain usable on mobile and desktop

Future navigation items should not be added before their corresponding features exist.

---

# 8. Component Guidelines

Create a reusable component only when:

* The same UI pattern appears in multiple places.
* The component has an independent responsibility.
* Reuse removes meaningful duplication.

Reusable components should:

* Accept data and callbacks through props.
* Avoid page-specific business logic.
* Avoid direct API calls.
* Keep styles in their own CSS file.
* Remain focused and predictable.

Possible reusable components may include:

```text
Button
Input
Modal
Loader
Badge
EmptyState
```

Do not create them before actual reuse is required.

---

# 9. Page Responsibilities

Pages may:

* Fetch page-specific data.
* Manage page-specific state.
* Coordinate API calls.
* Compose reusable components.
* Handle page-level loading and errors.

Pages should not:

* Duplicate global authentication logic.
* Construct backend base URLs.
* Contain unrelated feature logic.
* Create abstractions for hypothetical future use.

---

# 10. API Integration

All backend requests must use the shared Axios configuration.

```text
src/api/axios.js
```

Rules:

* Do not construct backend base URLs inside pages or components.
* Protected requests must use the stored JWT.
* Invalid authentication must clear the session.
* Backend validation messages should be shown when useful.
* API-specific logic should remain separate from reusable visual components.
* Avoid duplicate request logic when an existing API function already exists.

---

# 11. Authentication

```text
Register / Login
→ Receive JWT
→ Store Token
→ Verify Session
→ Update Authentication Context
→ Access Protected Routes
```

Requirements:

* Public pages remain accessible without authentication.
* Authenticated users are redirected away from Login and Register.
* Unauthenticated users cannot access protected routes.
* Login and registration update global authentication state.
* Logout clears the token and resets the session.
* Invalid or expired tokens are removed.
* Authentication-aware UI updates immediately.

---

# 12. Route Strategy

## Public Routes

```text
/
```

## Authentication Routes

```text
/login
/register
```

Authenticated users should be redirected away from authentication routes.

## Protected Routes

Current examples:

```text
/dashboard
/organization
/permissions
/invitations
```

Future protected routes should be added only when implementation begins.

---

# 13. State Management

Use React Context only for state that is genuinely shared across multiple areas.

Current global responsibility:

```text
Authentication Context
→ User
→ Session
→ Authentication state
```

Page-specific state should remain local unless multiple unrelated pages need the same live state.

Avoid introducing additional global state libraries unless the existing architecture creates a real limitation.

---

# 14. Multi-User Synchronization

Organization state uses backend revisions for stale-state detection.

The frontend should preserve the existing synchronization model:

```text
Load State
→ Store Revision
→ Check Latest Revision

Same Revision
→ No Action

New Revision
→ Fetch Consistent Snapshot
→ Update Local State
```

Local mutations should:

```text
Mutation
→ Backend Revision Increment
→ Update Local State
→ Synchronize Local Revision
```

Rules:

* Avoid unnecessary full-page reloads.
* Preserve valid user selections after refresh.
* Reject inconsistent snapshots.
* Prevent duplicate concurrent refreshes.
* Do not show false update notifications for local mutations.

Future document synchronization should follow its own backend consistency model rather than automatically reusing organization revision logic.

---

# 15. Document Management UI Architecture

Document Management includes the complete document lifecycle.

It should not be split into unrelated upload and document phases.

```text
Document Library
+
Draft Upload
+
Metadata
+
Classification
+
Access Configuration
+
Publication
+
Versions
+
Access Management
+
History
+
Deletion
```

## Draft Upload Flow

```text
Select File
→ Validate File
→ Upload Draft
→ Configure Metadata
→ Select Classification
→ Configure Access
→ Review
→ Publish
```

The UI must distinguish:

```text
DRAFT
≠
SUBMITTED
≠
PROCESSING
≠
READY
≠
DELETED
```

A draft may remain temporarily in storage while configuration is completed.

The interface should clearly show draft expiry.

## Document Lifecycle

```text
DRAFT
→ SUBMITTED
→ QUEUED
→ PROCESSING
→ READY
```

Additional states:

```text
PROCESSING → FAILED

DRAFT → EXPIRED

READY → DELETED
```

The frontend displays lifecycle state but does not determine authoritative state transitions.

---

# 16. Document Access UI

Document access is separate from administrative permission management.

Access subjects:

```text
ORGANIZATION
UNIT
ROLE
USER
```

Access actions:

```text
QUERY
VIEW
DOWNLOAD
MANAGE_ACCESS
```

The interface should eventually support:

* Current access policies
* Unit scope selection
* Role access
* Specific-user access
* Permanent access
* Temporary access
* Access revocation
* Change reasons
* Access history

Temporary access should clearly display start time, expiry time, and expired state.

The frontend must not assume that a user's administrative role automatically grants document access.

---

# 17. Access History UI

Access history is append-only.

The frontend may display:

```text
Actor
Subject
Event Type
Previous State
New State
Reason
Timestamp
```

The interface must not provide edit or delete operations for audit records.

Current access state and historical events should remain visually distinct.

---

# 18. Loading, Empty, and Error States

Every data-driven interface should handle:

```text
Loading
Empty
Success
Validation Error
Permission Error
Server Error
```

Guidelines:

* Do not show blank pages while loading.
* Empty states should explain what the user can do next.
* Permission errors should not appear as generic failures.
* Backend validation messages should be preserved when useful.
* Destructive actions should require clear confirmation.

---

# 19. Responsive Design

Every new page should be tested for:

* Desktop
* Tablet
* Mobile

Guidelines:

* Avoid horizontal page overflow.
* Allow large panels to scroll within controlled boundaries.
* Keep important actions accessible.
* Stack layouts when horizontal space is insufficient.
* Preserve readable text widths.
* Avoid fixed heights unless the interface requires them.

Responsive behavior should be designed during implementation, not postponed until final polish.

---

# 20. Development Workflow

Each step should modify only:

```text
2–3 related files
or
2–3 related functions
```

Workflow:

```text
Implement
→ Test
→ Fix Issues
→ Update Development Log
→ Continue
```

Rules:

* Do not skip testing.
* Do not combine unrelated features.
* Do not add unnecessary files.
* Do not rename working variables without a reason.
* Do not restructure stable code unnecessarily.
* Finish the current step before starting the next one.

---

# 21. Implementation Order

Development should follow backend readiness.

```text
Backend Feature Ready
→ Confirm API Contract
→ Add Frontend API Integration
→ Build UI
→ Test Success Cases
→ Test Validation and Permission Errors
→ Test Responsive Behavior
→ Update Development Log
```

For Document Management:

```text
Backend Document APIs Ready
→ Document API Layer
→ Document Library
→ Draft Upload
→ Metadata and Classification
→ Access Configuration
→ Publication
→ Document Details
→ Version History
→ Access Management
→ Access History
→ Download and Delete Flows
```

Do not build UI against speculative API contracts.

---

# 22. Coding Standards

* Keep components small and focused.
* Reuse existing components when meaningful.
* Avoid duplicate code.
* Follow existing naming conventions.
* Keep styles isolated.
* Keep API logic out of reusable visual components.
* Do not rename existing variables or files unnecessarily.
* Do not change folder structure without a real need.
* Add abstractions only when current code requires them.
* Test every feature before continuing.

---

# 23. Documentation Boundaries

This guide defines:

```text
Frontend architecture
Development standards
UI rules
Implementation workflow
```

The frontend development log defines:

```text
Completed work
Current progress
Planned frontend features
Next implementation step
```

`docs/DATABASE.md` defines:

```text
Database architecture
Document models
Access models
Storage relationships
Future retrieval mapping
```

The backend development log defines:

```text
Backend implementation progress
Completed backend behavior
Current backend phase
```

Avoid duplicating detailed architecture or progress across these documents.

---

# Project Philosophy

The frontend should resemble a modern enterprise SaaS application rather than an academic project.

Every interface should answer:

1. Is the feature easy to understand?
2. Is it consistent with the rest of the application?
3. Can it be extended without unnecessary restructuring?

The goal is a professional frontend that supports secure organization management, document workflows, and permission-aware enterprise knowledge retrieval.
