# Enterprise Retrieval-Augmented Generation (RAG) Platform

> A production-inspired platform for securely managing and querying organizational knowledge using permission-aware retrieval and Retrieval-Augmented Generation.

---

# Overview

Enterprise knowledge is distributed across financial reports, legal contracts, HR policies, technical documentation, research papers, and internal knowledge bases.

General-purpose AI assistants can produce unsupported answers, expose information without respecting organizational boundaries, and fail to reflect changing documents.

This project is designed around one core rule:

~~~text
Unauthorized content must never reach the LLM.
~~~

The platform combines enterprise organization management, document lifecycle management, access control, retrieval infrastructure, and AI generation into one system.

Current implementation includes organization management, document versioning, access policies, background document-processing orchestration, and AI-service vector indexing. Authorized retrieval, hybrid search, reranking, and grounded answer generation remain planned work.

---

# What the Platform Does

Organizations can:

* Create and manage an isolated enterprise workspace
* Structure members into departments, teams, and groups
* Delegate permissions within specific hierarchy scopes
* Manage members, invitations, and organizational changes
* Upload and version enterprise documents
* Control who can access each document
* Process and index organizational knowledge
* Plan for authorized hybrid retrieval and grounded answers with citations

---

# System Flow

~~~text
Organization Setup
→ Member and Permission Management
→ Document Upload
→ Access Configuration
→ Document Processing
→ Knowledge Indexing
→ Permission-Aware Retrieval
→ Grounded Answer Generation
→ Citations and Verification
~~~

The organization and authorization layer determines what a user is allowed to access before enterprise knowledge is used for retrieval or generation.

---

# High-Level Architecture

~~~text
React Frontend
        ↓
Node.js + Express API
        ↓
PostgreSQL + Prisma
        ├── Organizations and Users
        ├── Permissions
        ├── Documents and Versions
        └── Access Policies

Amazon S3
        └── File Storage

Redis + BullMQ
        ├── Caching
        └── Background Jobs

FastAPI AI Service
        ├── Document Processing
        ├── Chunking
        ├── Embeddings
        └── Version-aware vector indexing

Qdrant
        └── Vector storage (authorized retrieval pending)

LLM
        └── Grounded Answer Generation
~~~

Each component has a separate responsibility:

* **PostgreSQL** is the source of truth for application state and authorization.
* **Amazon S3** stores original and versioned files.
* **Redis and BullMQ** provide the document-processing queue when enabled.
* **FastAPI** handles AI and document-processing workloads.
* **Qdrant** stores version-aware document vectors; authorized retrieval remains pending.
* **The LLM** will receive only authorized and validated context when generation is implemented.

---

# Enterprise Organization and Access

Each organization has an isolated hierarchical workspace:

~~~text
COMPANY
└── DEPARTMENT
    └── TEAM
        └── GROUP
~~~

The platform supports:

* Organization and unit management
* Member invitations and onboarding
* Member movement and removal
* Unit and subtree reorganization
* Capacity management
* Scoped permission delegation

Authorization is not based on roles alone.

~~~text
Effective Authority
=
Permission
+
Hierarchy Scope
+
Delegation Authority
~~~

This allows users to receive specific administrative authority only within the parts of the organization they are responsible for.

The platform also protects shared organization state using transaction-safe mutations, conflict handling, and revision-based multi-user synchronization.

---

# Document and Knowledge Lifecycle

Documents move through the following backend lifecycle; end-to-end indexing verification is still in progress:

~~~text
Upload
→ Validate Access
→ Store File
→ Create Version
→ Queue Processing
→ Extract Content
→ Create Chunks
→ Generate Embeddings
→ Index for Retrieval
→ Mark Ready
~~~

Documents are versioned instead of overwritten so previous states can be preserved and recovered.

Document access is separate from administrative permissions and may be assigned to:

~~~text
Organization
Unit
User
Role
~~~

Access policies can also support temporary and scheduled access.

---

# Secure Retrieval and RAG

A user query will pass through a permission-aware retrieval pipeline:

~~~text
User Query
→ Authentication
→ Resolve Authorized Documents
→ Semantic + Keyword Retrieval
→ Metadata Filtering
→ Authorization Validation
→ Reranking
→ Context Validation
→ Answer Generation
→ Verification
→ Citations
~~~

Authorization is enforced before retrieval and validated again before retrieved content reaches the LLM.

If sufficient supporting evidence is unavailable, the system should avoid generating an unsupported answer.

---

# Key Engineering Goals

The project focuses on:

* Multi-tenant organization isolation
* Hierarchical and delegated authorization
* Concurrency-safe state mutations
* Multi-user state synchronization
* Secure document lifecycle management
* Permission-aware retrieval
* Incremental document indexing
* Hybrid search and reranking
* Grounded answers with citations
* Hallucination reduction
* Version-aware caching
* Measurable retrieval and generation quality

---

# Technology Stack

~~~text
Frontend
└── React + Vite

Backend API
└── Node.js + Express.js

Database
└── PostgreSQL + Prisma

File Storage
└── Amazon S3

AI Service
└── FastAPI + Sentence Transformers

Vector Database
└── Qdrant

Caching and Background Jobs
└── Redis + BullMQ
~~~
---

# Project Documentation

Detailed implementation decisions and development progress are maintained separately:

Additional implementation documentation:

- `docs/ai-service.md` — AI-service implementation and handoff details
- `docs/frontendDevelopment.md` — frontend architecture and development guide
- `docs/frontendDevelopmentLog.md` — frontend implementation progress

~~~text
README.md
→ Overall project understanding

Backend Development Log
→ Backend implementation progress

Frontend Development Log
→ Frontend implementation progress

docs/DATABASE.md
→ Database models and design decisions
~~~

---

# Project Goal

The goal is not to build another chatbot.

The goal is to engineer a secure enterprise knowledge platform where organizational access rules, document state, retrieval quality, and generated answers work together as one system.

~~~text
Authorized Knowledge
→ Relevant Retrieval
→ Validated Context
→ Grounded Answer
~~~
