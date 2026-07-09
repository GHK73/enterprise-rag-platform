# Enterprise Retrieval-Augmented Generation (RAG) Platform

> A production-inspired enterprise RAG platform for securely ingesting, versioning, retrieving, and querying organizational knowledge using permission-aware retrieval, document lifecycle management, and configurable RAG pipelines.

---

# Overview

Enterprise knowledge is distributed across financial reports, legal contracts, HR policies, technical documentation, research papers, and internal knowledge bases.

Traditional AI assistants can:

* Hallucinate unsupported information
* Ignore organizational access boundaries
* Expose confidential documents
* Fail to reflect document updates
* Generate answers without supporting evidence

This platform addresses these problems by retrieving only authorized and relevant information before generating an answer.

The primary rule of the system is:

```text
Unauthorized content must never reach the LLM.
```

---

# Core Objectives

* Build a secure multi-tenant enterprise RAG platform
* Isolate knowledge between organizations
* Enforce authorization before document content reaches the LLM
* Preserve complete document and version history
* Support permission-aware retrieval
* Reduce hallucinations through retrieval and answer validation
* Build modular and configurable RAG components
* Improve performance using caching and background processing
* Measure retrieval quality, generation quality, and system performance

---

# High-Level Architecture

```text
Frontend
React + Vite
        ↓
Backend API
Node.js + Express.js
        ↓
PostgreSQL + Prisma
        ├── Organizations
        ├── Users
        ├── Permissions
        ├── Documents
        ├── Versions
        ├── Access Policies
        └── Chunk Metadata

Amazon S3
        ├── Original Files
        ├── Versioned Files
        └── Processed Artifacts

Redis + BullMQ
        ├── Caching
        └── Background Jobs

FastAPI AI Service
        ├── Text Extraction
        ├── Chunking
        ├── Embeddings
        ├── Reranking
        └── AI Processing

Qdrant
        └── Vector Retrieval

LLM
        └── Answer Generation and Verification
```

---

# Enterprise Organization Model

Each organization is represented as a hierarchical tree:

```text
COMPANY
└── DEPARTMENT
    └── TEAM
        └── GROUP
```

The hierarchy supports:

* Organization management
* Department, team, and group management
* Member invitations
* Role management
* Member movement between units
* Member removal
* Unit and subtree movement
* Capacity allocation

This hierarchy is also used to determine where permissions are valid.

---

# Authorization Model

The platform does not rely on roles alone.

```text
Effective Access
=
Permission
AND
Hierarchy Scope
AND
Valid Delegation
```

Roles classify members:

```text
OWNER
ADMIN
MANAGER
MEMBER
```

Atomic permissions control individual operations:

```text
INVITE_MEMBER
REMOVE_MEMBER
UPDATE_MEMBER
ASSIGN_ROLE
MOVE_MEMBER

CREATE_UNIT
UPDATE_UNIT
DELETE_UNIT
MOVE_UNIT
```

Each permission grant contains:

```text
Permission
→ What action is allowed?

Scope
→ Where in the organization hierarchy is it allowed?

Delegation
→ Who granted the authority?

Can Delegate
→ Can the recipient grant the permission to others?
```

Example:

```text
Engineering Head
└── MOVE_UNIT
    ├── Scope: Engineering
    └── Can Delegate: true
```

The permission is valid only inside the Engineering subtree.

---

# Capacity Management

Capacity controls how members and child units are distributed through the organization hierarchy.

```text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Direct Child Allocations
```

Example:

```text
Engineering Capacity = 100

├── Direct Members = 10
├── Backend Allocation = 40
├── Frontend Allocation = 30
└── Remaining Capacity = 20
```

Capacity is validated when:

* Accepting invitations
* Updating unit capacity
* Moving members
* Moving units

This prevents any operation from exceeding the capacity available in the hierarchy.

---

# Document Architecture

The document system separates application metadata, file storage, and vector retrieval.

```text
PostgreSQL + Prisma
→ Document metadata
→ Document versions
→ Access policies
→ Processing status
→ Chunk metadata
→ Storage references
→ Vector references

Amazon S3
→ Original files
→ Versioned file objects
→ Processed artifacts

Qdrant
→ Embedding vectors
→ Chunk references
→ Filtered vector retrieval

Redis + BullMQ
→ Caching
→ Background processing
```

PostgreSQL remains the source of truth for authorization and document state.

Amazon S3 stores files.

Qdrant stores vectors for retrieval.

Redis and BullMQ handle caching and asynchronous processing.

---

# Document Lifecycle

Documents are versioned instead of overwritten.

```text
Upload
→ Validate Access
→ Create Document
→ Store File in S3
→ Create Document Version
→ Queue Processing Job
→ Extract Text or OCR
→ Create Chunks
→ Generate Embeddings
→ Index in Qdrant
→ Mark Document READY
```

The document system supports:

* Document upload
* Metadata management
* Automatic versioning
* Processing status tracking
* OCR
* Rollback
* Soft deletion
* Recovery
* Authorized downloads using short-lived S3 presigned URLs

Each update creates a new document version while preserving previous versions.

---

# Permission-Aware Document Access

Operational permissions and document access are separate concepts.

```text
PermissionGrant
→ Can the user perform an operation?

DocumentAccessPolicy
→ Can the user access this document?
```

Document access policies can target:

```text
ORGANIZATION
UNIT
USER
ROLE
```

Policies can also be time-bound:

```text
validFrom
validUntil
revokedAt
```

Example:

```text
July 1 → July 15
Finance only

July 15 → August 1
Finance + Managers

After August 1
Entire organization
```

Changing document access does not require moving files or rebuilding embeddings.

```text
S3 File          → Unchanged
Document Record  → Unchanged
Chunks           → Unchanged
Qdrant Vectors   → Unchanged
Active Policy    → Changes
```

PostgreSQL remains the authorization authority.

---

# Incremental Indexing

When a document changes, the platform avoids regenerating embeddings for unchanged content.

```text
New Version
→ Extract Content
→ Create Chunks
→ Calculate Content Hashes
→ Compare With Previous Version
→ Reuse Unchanged Chunks
→ Embed Only Changed Chunks
→ Update Qdrant
```

This provides:

* Faster indexing
* Lower embedding costs
* Less duplicate processing
* Faster document synchronization

---

# Secure Retrieval Pipeline

Every query passes through a permission-aware retrieval pipeline.

```text
User Query
      ↓
Authentication
      ↓
Resolve Active Document Access
      ↓
Query Processing
      ↓
┌────────────────┬────────────────┐
│                │                │
Semantic Search  Keyword Search   Metadata Filters
│                │                │
└────────────────┴────────────────┘
      ↓
Merge Results
      ↓
Final Authorization Validation
      ↓
Reranking
      ↓
Context Validation
      ↓
Answer Generation
      ↓
Answer Verification
      ↓
Citation Generation
      ↓
Response
```

Authorization is checked before retrieval and validated again before context reaches the LLM.

---

# Qdrant Retrieval Model

Qdrant stores embedding vectors with stable identifiers.

Example payload:

```text
{
    organizationId,
    documentId,
    versionId,
    chunkId,
    isCurrentVersion
}
```

Retrieval flow:

```text
User Query
→ Resolve Active Access in PostgreSQL
→ Determine Authorized Search Scope
→ Search Qdrant
→ Retrieve Candidate Chunks
→ Validate Authorization Again
→ Rerank Results
→ Send Authorized Context to LLM
```

Frequently changing access policies remain in PostgreSQL instead of being treated as static vector metadata.

This avoids rebuilding vectors whenever access rules change.

---

# Hallucination Reduction

The platform prioritizes supported answers over uncertain generation.

Techniques include:

* Hybrid retrieval
* Context validation
* Confidence thresholds
* Retrieval verification
* Answer verification
* Citation generation
* Permission-aware context filtering

If sufficient evidence cannot be retrieved, the system should refuse to generate an unsupported answer.

---

# Intelligent Query Caching

The platform uses multiple caching strategies:

```text
Exact Query Cache
Semantic Query Cache
Redis Response Cache
```

Before returning a cached response, the system validates:

* Current user access
* Current document versions
* Source chunk integrity
* Confidence thresholds
* Verification status

Only cache entries affected by changed documents or access conditions should be invalidated.

---

# Configurable RAG Pipeline

Major RAG components can be enabled, disabled, or replaced through configuration.

```env
# Retrieval
RETRIEVAL_MODE=hybrid

# Caching
REDIS_ENABLED=true
QUERY_CACHE_ENABLED=true
SEMANTIC_CACHE_ENABLED=true

# AI Pipeline
RERANKER_ENABLED=true
QUERY_EXPANSION_ENABLED=false
HALLUCINATION_CHECK_ENABLED=true
CITATION_GENERATION_ENABLED=true

# Document Processing
INCREMENTAL_INDEXING_ENABLED=true
OCR_ENABLED=false
STREAMING_ENABLED=true

# Monitoring
AUDIT_LOGGING_ENABLED=true
METRICS_ENABLED=true

# Models
EMBEDDING_MODEL=bge-small-en
LLM_PROVIDER=llama
```

The configurable pipeline includes:

```text
Retrieval
├── Semantic Search
├── Keyword Search
└── Hybrid Search

Embeddings
├── BGE
├── E5
└── MiniLM

Query Processing
├── Query Expansion
├── Metadata Filtering
└── Context Compression

Generation
├── Multiple LLM Providers
├── Streaming
└── Citations

Reliability
├── Hallucination Detection
└── Answer Verification

Performance
├── Redis Caching
├── Background Processing
└── Incremental Indexing
```

---

# Performance Optimizations

The platform uses or explores:

* Redis caching
* BullMQ workers
* Background processing
* Parallel retrieval
* `Promise.all()`
* `Promise.allSettled()`
* Event-driven architecture
* Streaming responses
* Incremental embedding updates
* Filtered vector retrieval
* Version-aware cache invalidation

Major optimizations should be benchmarked before and after implementation.

---

# Evaluation Framework

The system evaluates retrieval quality, generation quality, and performance.

## Retrieval Metrics

* Recall@K
* Precision@K
* Mean Reciprocal Rank (MRR)
* Hit Rate
* Normalized Discounted Cumulative Gain (NDCG)

## Generation Metrics

* Faithfulness
* Answer relevancy
* Hallucination rate
* Citation accuracy

## Performance Metrics

* Average response time
* Retrieval latency
* Embedding latency
* LLM latency
* Cache hit rate
* Throughput
* Token usage
* Cost reduction

---

# Technology Stack

```text
Frontend
├── React
├── Vite
├── Axios
└── CSS

Backend
├── Node.js
└── Express.js

Database
├── PostgreSQL
└── Prisma ORM

File Storage
└── Amazon S3

AI Services
├── FastAPI
├── Sentence Transformers
└── Lightweight LLMs

Vector Retrieval
└── Qdrant

Background Processing and Caching
├── Redis
└── BullMQ
```

---

# Project Philosophy

Every major engineering decision should answer:

1. Why is this needed?
2. How does it improve the system?
3. Can the improvement be measured?

The goal is not to build another chatbot.

The goal is to engineer a secure, scalable, explainable, permission-aware, and measurable enterprise knowledge retrieval platform.
