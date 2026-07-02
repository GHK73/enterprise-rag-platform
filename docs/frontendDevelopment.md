# Frontend Architecture & Development Guide

Defines the frontend architecture, coding standards, UI guidelines, and development workflow for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

---

# Goals

The frontend should provide a professional, scalable, and maintainable enterprise user experience.

Development principles:

- Build reusable components.
- Keep pages independent.
- Maintain consistent UI.
- Avoid unnecessary files and abstractions.
- Develop incrementally.
- Test every feature before proceeding.

---

# Technology Stack

| Layer | Technology |
| ------ | ---------- |
| Framework | React |
| Routing | React Router DOM |
| Styling | Component-based CSS |
| HTTP Client | Axios |
| State Management | React Context API |
| Build Tool | Vite |

---

# Project Structure

```text
frontend/
│
├── public/
│
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── Navbar/
│   │   ├── Sidebar/
│   │   ├── Topbar/
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Input/
│   │   ├── Loader/
│   │   ├── Modal/
│   │   └── EmptyState/
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
│   │   ├── Query/
│   │   ├── Analytics/
│   │   └── Settings/
│   │
│   ├── services/
│   ├── context/
│   ├── hooks/
│   ├── routes/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
└── package.json
```

---

# Styling Guidelines

Every page and reusable component must have its own CSS file.

Example:

```text
Login/
    Login.jsx
    Login.css

Navbar/
    Navbar.jsx
    Navbar.css
```

`index.css` should contain only:

- CSS reset
- Font imports
- CSS variables
- Global typography
- Scrollbar styling

Use:

- `rem` for fonts, spacing, and border radius.
- `%`, `vw`, `vh`, `min()`, `max()`, and `clamp()` for responsive sizing.
- Flexbox and CSS Grid for layouts.
- `1px` only where fixed borders are required.

---

# Layout Strategy

## Public Layout

Used for:

- Home
- Login
- Register

Contains:

- Navbar
- Main Content

---

## Dashboard Layout

Used after authentication.

Contains:

- Sidebar
- Topbar
- Main Content

The public navigation bar is not displayed inside the dashboard.

---

# Navigation

## Public Navigation

- Home
- Features
- Documentation
- GitHub
- Login
- Register

---

## Dashboard Sidebar

- Dashboard
- Organization
- Documents
- Upload
- Search
- Analytics
- Settings
- Logout

---

# Design System

## Colors

| Purpose | Color |
| -------- | ----- |
| Primary | #2563EB |
| Secondary | #1E293B |
| Background | #F8FAFC |
| Card | #FFFFFF |
| Border | #E2E8F0 |
| Success | #22C55E |
| Warning | #F59E0B |
| Error | #EF4444 |
| Primary Text | #0F172A |
| Secondary Text | #64748B |

### Typography

- Primary Font: Inter
- Fallback: sans-serif

---

# Component Guidelines

Reusable components should:

- Accept data through props.
- Contain no business logic.
- Contain no API calls.
- Be reusable across multiple pages.
- Keep styling within their own CSS file.

Examples:

- Button
- Input
- Card
- Modal
- Loader
- Badge
- EmptyState

---

# API Integration

Frontend communicates only with the backend REST API.

- Components must never construct API URLs.
- All requests should go through the `services` layer.

---

# Authentication Flow

```text
Login
   │
Receive JWT
   │
Store Token
   │
Protected Routes
   │
Dashboard
```

Unauthenticated users should only access public pages.

---

# Dashboard Philosophy

The dashboard should prioritize clarity over decoration.

Guidelines:

- Clean spacing
- Consistent layout
- Minimal animations
- Responsive design
- Predictable navigation
- Fast loading

---

# Development Workflow

Each implementation step should modify only:

- 2–3 related files, or
- 2–3 related functions.

Workflow:

1. Implement
2. Test
3. Fix issues
4. Commit
5. Continue

Do not introduce unnecessary files or abstractions.

---

# Development Roadmap

## Phase 1

- Project Setup
- Routing
- Public Layout
- Home Page

---

## Phase 2

- Login
- Register
- Authentication Integration

---

## Phase 3

- Dashboard Layout
- Sidebar
- Topbar
- Protected Routes

---

## Phase 4

- Organization Management

---

## Phase 5

- Document Management

---

## Phase 6

- Document Upload

---

## Phase 7

- Retrieval Interface

---

## Phase 8

- Search Results
- Citations
- Streaming Responses

---

## Phase 9

- Analytics Dashboard

---

## Phase 10

- Settings
- User Profile
- Final UI Polish

---

# Coding Standards

- Keep components small and focused.
- Reuse existing components whenever possible.
- Avoid duplicate code.
- Follow consistent naming conventions.
- Keep styles isolated to their corresponding component or page.
- Do not rename existing variables or files unless necessary.
- Do not change the folder structure unnecessarily.
- Test every feature before moving forward.

---

# Project Philosophy

The frontend should resemble a modern enterprise SaaS application rather than a traditional academic project.

Every interface should answer three questions:

1. Is the feature easy to understand?
2. Is the layout consistent with the rest of the application?
3. Can the feature be extended without restructuring the project?

The objective is to build a professional, scalable, and maintainable frontend that complements the Enterprise Retrieval-Augmented Generation (RAG) Platform.