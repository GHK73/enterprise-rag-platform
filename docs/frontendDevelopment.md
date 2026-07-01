# Frontend Development Guide

This document defines the frontend architecture, development standards, folder structure, UI guidelines, and implementation roadmap for the Enterprise Retrieval-Augmented Generation (RAG) Platform.

---

# Goals

The frontend should provide a professional enterprise user experience while remaining modular, maintainable, and scalable.

Development follows these principles:

* Build reusable components.
* Keep pages independent.
* Maintain consistent UI throughout the application.
* Avoid unnecessary files or abstractions.
* Implement features incrementally.
* Test each feature before moving to the next.

---

# Technology Stack

| Layer            | Technology                                    |
| ---------------- | --------------------------------------------- |
| Framework        | React                                         |
| Routing          | React Router                                  |
| Styling          | CSS Modules (One CSS file per page/component) |
| HTTP Client      | Axios                                         |
| State Management | React Context API                             |
| Build Tool       | Vite                                          |

---

# Project Structure

```text
frontend/
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │
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
│   │
│   ├── context/
│   │
│   ├── hooks/
│   │
│   ├── routes/
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
└── package.json
```

---

# CSS Guidelines

Every page must have its own stylesheet.

Example:

```text
Login/
    Login.jsx
    Login.css
```

Every reusable component must also have its own stylesheet.

Example:

```text
Button/
    Button.jsx
    Button.css
```

The global stylesheet (`index.css`) should only contain:

* CSS reset
* Font imports
* Color variables
* Global typography
* Scrollbar styling

Page-specific styling must never be placed in `index.css`.

---

# Layout Strategy

The application uses two layouts.

## Public Layout

Used for:

* Home
* Login
* Register

Contains:

* Navigation Bar
* Main Content

---

## Dashboard Layout

Used after authentication.

Contains:

* Sidebar
* Topbar
* Main Content Area

The public navigation bar is not displayed inside the dashboard.

---

# Navigation Structure

## Public Navigation

* Home
* Features
* Documentation
* GitHub
* Login
* Register

---

## Dashboard Sidebar

* Dashboard
* Organization
* Documents
* Upload
* Search
* Analytics
* Settings
* Logout

---

# Design System

## Primary Colors

| Purpose        | Color   |
| -------------- | ------- |
| Primary        | #2563EB |
| Secondary      | #1E293B |
| Background     | #F8FAFC |
| Card           | #FFFFFF |
| Border         | #E2E8F0 |
| Success        | #22C55E |
| Warning        | #F59E0B |
| Error          | #EF4444 |
| Primary Text   | #0F172A |
| Secondary Text | #64748B |

---

# Typography

Primary Font:

Inter

Fallback:

sans-serif

---

# Component Guidelines

Reusable components should remain generic.

Examples:

* Button
* Input
* Card
* Modal
* Loader
* Badge
* Empty State

Business logic must not be placed inside reusable UI components.

---

# API Integration

Frontend communicates only with the backend REST API.

No component should directly construct API URLs.

All HTTP requests should go through the `services` layer.

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
Authenticated Dashboard
```

Unauthenticated users should only access public pages.

---

# Dashboard Philosophy

The dashboard should prioritize clarity over decoration.

Guidelines:

* Clean spacing
* Minimal animations
* Consistent cards
* Predictable navigation
* Responsive layout
* Fast loading

---

# Development Workflow

Features are implemented incrementally.

Each step should include only 2–3 related files.

For every step:

1. Implement the feature.
2. Test it.
3. Fix issues.
4. Commit changes.
5. Move to the next feature.

Do not introduce unnecessary files or abstractions.

---

# Initial Development Roadmap

## Phase 1

* Project setup
* Routing
* Public layout
* Home page

---

## Phase 2

* Login page
* Register page
* Authentication integration

---

## Phase 3

* Dashboard layout
* Sidebar
* Topbar
* Protected routes

---

## Phase 4

* Organization management

---

## Phase 5

* Document management

---

## Phase 6

* Document upload

---

## Phase 7

* Retrieval interface

---

## Phase 8

* Search results
* Citations
* Streaming responses

---

## Phase 9

* Analytics dashboard

---

## Phase 10

* Settings
* User profile
* Final UI polish

---

# Coding Standards

* Keep components small and focused.
* Reuse existing components whenever possible.
* Avoid duplicate code.
* Follow consistent naming conventions.
* Keep styling isolated to the corresponding component or page.
* Test every feature before proceeding.
* Do not rename existing variables or files unless necessary.
* Do not create files unless they are required for the current feature.

---

# Project Philosophy

The frontend should resemble a modern enterprise SaaS application rather than a traditional academic project.

Every interface should answer three questions:

1. Is the feature easy to understand?
2. Is the layout consistent with the rest of the application?
3. Can the feature be extended without restructuring the project?

The objective is to build a professional, scalable, and maintainable frontend that complements the Enterprise Retrieval-Augmented Generation (RAG) Platform.
