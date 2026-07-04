# Frontend Architecture & Development Guide

Defines the architecture, development standards, UI guidelines, and implementation workflow for the Enterprise Retrieval-Augmented Generation (RAG) Platform frontend.

---

# Goals

Build a professional, scalable, and maintainable enterprise frontend.

Development principles:

- Build reusable components when reuse is required.
- Keep pages independent and focused.
- Maintain consistent UI and styling.
- Avoid unnecessary files and abstractions.
- Develop incrementally.
- Modify only 2–3 related files or functions at a time.
- Test every feature before continuing.
- Do not rename existing variables or restructure working code unnecessarily.

---

# Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React |
| Routing | React Router DOM |
| Styling | Component-based CSS |
| HTTP Client | Axios |
| State Management | React Context API |
| Build Tool | Vite |

---

# Project Structure

Create folders and files only when required by the current implementation phase.

```text
frontend/
│
├── public/
│
├── src/
│   ├── assets/
│   │
│   ├── api/
│   │   └── axios.js
│   │
│   ├── components/
│   │   ├── Navbar/
│   │   ├── ProtectedRoute/
│   │   ├── PublicRoute/
│   │   ├── Sidebar/
│   │   └── Topbar/
│   │
│   ├── context/
│   │   └── AuthContext.jsx
│   │
│   ├── layouts/
│   │   ├── PublicLayout.jsx
│   │   └── DashboardLayout.jsx
│   │
│   ├── pages/
│   │   ├── Home/
│   │   ├── Login/
│   │   ├── Register/
│   │   ├── Dashboard/
│   │   ├── Organization/
│   │   ├── Documents/
│   │   ├── Upload/
│   │   ├── Query/
│   │   ├── Analytics/
│   │   └── Settings/
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
└── package.json
```

Do not create empty folders or placeholder components before they are needed.

---

# Styling Guidelines

Every page and reusable component should have its own CSS file.

Example:

```text
Login/
├── Login.jsx
└── Login.css

Navbar/
├── Navbar.jsx
└── Navbar.css
```

`index.css` should contain only global styles:

- CSS reset
- Font imports
- CSS variables
- Global typography
- Global element defaults
- Scrollbar styling

Use:

- `rem` for fonts, spacing, and border radius.
- `%`, `vw`, `vh`, `min()`, `max()`, and `clamp()` for responsive sizing.
- Flexbox and CSS Grid for layouts.
- `1px` only where fixed borders are required.
- Existing CSS variables instead of repeating color values.

Avoid:

- Inline styles.
- Unnecessary fixed widths and heights.
- Duplicate global styles.
- Page-specific styles inside `index.css`.

---

# Layout Strategy

## Public Layout

Used for:

- Home
- Login
- Register

Contains:

```text
Navbar
Main Content
```

The public Navbar should respond to authentication state:

```text
Logged Out → Login + Register
Logged In  → Logout
```

---

## Dashboard Layout

Used for authenticated application pages.

Contains:

```text
Sidebar
Topbar
Main Content
```

The public Navbar must not appear inside the dashboard.

Dashboard pages include:

- Dashboard
- Organization
- Documents
- Upload
- Query
- Analytics
- Settings

---

# Navigation

## Public Navigation

- Home
- Features
- Documentation
- GitHub
- Login
- Register
- Logout when authenticated

## Dashboard Sidebar

- Dashboard
- Organization
- Documents
- Upload
- Search
- Analytics
- Settings
- Logout

Navigation should remain consistent across all dashboard pages.

---

# Design System

## Colors

| Purpose | Color |
|---------|-------|
| Primary | `#2563EB` |
| Secondary | `#1E293B` |
| Background | `#F8FAFC` |
| Card | `#FFFFFF` |
| Border | `#E2E8F0` |
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |
| Primary Text | `#0F172A` |
| Secondary Text | `#64748B` |

These values should be defined as CSS variables and reused throughout the application.

## Typography

```text
Primary Font: Inter
Fallback: sans-serif
```

Typography should remain consistent across pages and components.

---

# Component Guidelines

Create a reusable component only when:

- The same UI pattern is used in multiple places.
- The component has a clear independent responsibility.
- Reuse reduces meaningful duplication.

Reusable components should:

- Accept data through props.
- Avoid page-specific business logic.
- Avoid direct API calls.
- Keep styling in their own CSS file.
- Remain focused and predictable.

Possible reusable components:

- Button
- Input
- Card
- Modal
- Loader
- Badge
- EmptyState

Do not create these components before they are actually needed.

---

# API Integration

The frontend communicates only with the backend REST API.

All requests should use the shared Axios instance:

```text
src/api/axios.js
```

Rules:

- Pages and components must not construct backend base URLs.
- Protected requests must include the JWT access token.
- API errors should be handled consistently.
- Invalid or expired authentication should clear the session.
- Backend error messages should be shown when appropriate.

---

# Authentication Flow

```text
Register / Login
        │
        ▼
   Receive JWT
        │
        ▼
Authentication Context
        │
        ▼
   Store Token
        │
        ▼
Update Authentication State
        │
        ▼
  Protected Routes
        │
        ▼
     Dashboard
```

Authentication requirements:

- Unauthenticated users can access public pages.
- Authenticated users cannot access Login or Register.
- Unauthenticated users cannot access protected pages.
- Login and registration update global authentication state.
- Logout removes the token and resets authentication state.
- Navbar content updates immediately when authentication state changes.

---

# Route Strategy

## Public Routes

Examples:

```text
/
```

Accessible to all users.

## Authentication Routes

Examples:

```text
/login
/register
```

Authenticated users should be redirected away from these routes.

## Protected Routes

Examples:

```text
/dashboard
/organization
/documents
/upload
/query
/analytics
/settings
```

Unauthenticated users should be redirected to Login.

---

# Dashboard Philosophy

The dashboard should prioritize clarity and usability over decoration.

Guidelines:

- Clean spacing.
- Consistent layout.
- Minimal animations.
- Responsive design.
- Predictable navigation.
- Clear loading states.
- Clear empty states.
- Clear error states.
- Fast interaction.

The dashboard should resemble a modern enterprise SaaS application.

---

# Development Workflow

Each implementation step should modify only:

- 2–3 related files, or
- 2–3 related functions.

Workflow:

```text
Implement
   │
   ▼
Test
   │
   ▼
Fix Issues
   │
   ▼
Update Development Log
   │
   ▼
Continue
```

Rules:

- Do not skip testing.
- Do not combine unrelated features in one step.
- Do not add unnecessary files.
- Do not rename working variables without a reason.
- Do not restructure working code unnecessarily.
- Complete the current feature before starting the next one.

---

# Development Roadmap

## Phase 1 — Frontend Foundation

- Project setup
- Dependencies
- Global styling
- Routing
- Public layout
- Responsive Navbar
- Home page
- Landing page sections

## Phase 2 — Authentication

- Login page
- Register page
- Axios configuration
- Login API integration
- Register API integration
- JWT storage
- Authentication Context
- Public route protection
- Protected routes
- Authentication redirects
- Authentication-aware Navbar
- Logout
- Protected API authorization
- Session verification
- Expired token handling

## Phase 3 — Dashboard Layout

- DashboardLayout
- Sidebar
- Topbar
- Responsive dashboard navigation
- Dashboard page structure

## Phase 4 — Organization Management

- Organization creation
- Organization details
- Organization membership
- Role-based UI access

## Phase 5 — Document Management

- Document listing
- Document details
- Document status
- Document actions

## Phase 6 — Document Upload

- Upload interface
- File validation
- Upload progress
- Processing status
- Upload error handling

## Phase 7 — Retrieval Interface

- Query input
- Retrieval configuration
- Query submission
- Response display

## Phase 8 — Search and Citations

- Search results
- Source citations
- Retrieved context
- Streaming responses

## Phase 9 — Analytics

- Usage metrics
- Document statistics
- Query statistics
- Retrieval performance

## Phase 10 — Settings and Final Polish

- User profile
- Organization settings
- Application settings
- Responsive improvements
- Accessibility review
- Loading and error states
- Final UI consistency review

---

# Coding Standards

- Keep components small and focused.
- Reuse existing components when meaningful.
- Avoid duplicate code.
- Follow consistent naming conventions.
- Keep styles isolated to the corresponding page or component.
- Do not rename existing variables or files unless necessary.
- Do not change the folder structure unnecessarily.
- Keep API logic separate from reusable UI components.
- Test every feature before moving forward.
- Add abstractions only when the existing code requires them.

---

# Project Philosophy

The frontend should resemble a modern enterprise SaaS application rather than a traditional academic project.

Every interface should answer three questions:

1. Is the feature easy to understand?
2. Is the layout consistent with the rest of the application?
3. Can the feature be extended without restructuring the project?

The objective is to build a professional, scalable, and maintainable frontend that complements the Enterprise Retrieval-Augmented Generation (RAG) Platform.