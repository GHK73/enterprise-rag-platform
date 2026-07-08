# Enterprise Retrieval-Augmented Generation (RAG) Platform

> A production-inspired enterprise RAG platform for securely ingesting, versioning, retrieving, and querying organizational knowledge. The system combines hierarchy-scoped authorization, permission-aware retrieval, document lifecycle management, configurable RAG pipelines, and measurable performance optimization.

---

# Motivation

Enterprise knowledge is distributed across financial reports, legal contracts, HR policies, technical documentation, research papers, and internal knowledge bases.

Traditional AI assistants often:

* Hallucinate unsupported information
* Ignore organizational access boundaries
* Expose confidential documents
* Fail to reflect document updates
* Return answers without supporting evidence

This project addresses these problems by retrieving authorized, trusted information before generating responses.

---

# Core Objectives

* Build a secure enterprise RAG platform
* Support multi-organization knowledge isolation
* Design modular RAG components without depending heavily on high-level frameworks
* Enforce authorization before document content reaches the LLM
* Preserve complete document and version history
* Reduce hallucinations using retrieval and answer validation
* Build scalable AI backend infrastructure
* Measure every major optimization

---

# Current Progress

~~~text
Backend Foundation              ✅
Authentication                  ✅
Organization Management         ✅
Organization Hierarchy          ✅
Permission Engine               ✅
Invitation Management           ✅
Member Access                   ✅
Capacity Management             ✅
Member Management               ✅
Unit Reorganization             ✅

Document Management             ⏳
Document Processing             ⏳
Retrieval Infrastructure        ⏳
RAG Pipeline                    ⏳
Reliability and Caching         ⏳
Evaluation and Monitoring       ⏳
Deployment                      ⏳
~~~

---

# Enterprise Organization Model

The platform models organizations as hierarchical trees:

~~~text
COMPANY
└── DEPARTMENT
    └── TEAM
        └── GROUP
~~~

Supported operations include:

* Organization creation and updates
* Department, team, and group management
* Member invitations
* Member role updates
* Member movement between units
* Member removal
* Unit and subtree movement
* Capacity allocation across the hierarchy

---

# Authorization Model

The platform does not rely on roles alone.

~~~text
Effective Access
=
Permission
AND
Hierarchy Scope
AND
Valid Delegation
~~~

Roles classify members:

~~~text
OWNER
ADMIN
MANAGER
MEMBER
~~~

Atomic permissions control actions:

~~~text
INVITE_MEMBER
REMOVE_MEMBER
UPDATE_MEMBER
ASSIGN_ROLE
MOVE_MEMBER

CREATE_UNIT
UPDATE_UNIT
DELETE_UNIT
MOVE_UNIT
~~~

Each permission grant includes:

~~~text
Permission
→ What action is allowed?

Scope
→ Where in the organization tree is it allowed?

Delegation
→ Who granted the authority?

Can Delegate
→ May the recipient grant it further?
~~~

Example:

~~~text
Engineering Head
└── MOVE_UNIT
    ├── Scope: Engineering
    └── Can Delegate: true
~~~

The permission applies only to the selected hierarchy subtree.

---

# Capacity Management

Organization capacity flows through the hierarchy.

~~~text
Remaining Capacity
=
Allocated Capacity
− Direct Members
− Direct Child Allocations
~~~

Example:

~~~text
Engineering Capacity = 100

├── Direct Members = 10
├── Backend Allocation = 40
├── Frontend Allocation = 30
└── Remaining Capacity = 20
~~~

Capacity is validated during:

* Invitation acceptance
* Capacity updates
* Member movement
* Unit movement

---

# Document Architecture

The document system separates application data, file storage, and vector retrieval.

~~~text
PostgreSQL + Prisma
→ Documents
→ Versions
→ Metadata
→ Access policies
→ Processing status
→ Chunks
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
~~~

---

# Document Lifecycle

The platform preserves document history instead of overwriting files.

Planned lifecycle:

~~~text
Upload
→ Validate Access
→ Create Document
→ Store File in S3
→ Create Document Version
→ Queue Processing Job
→ Extract Text / OCR
→ Chunk Content
→ Generate Embeddings
→ Index in Qdrant
→ Mark READY
~~~

Features include:

* Document upload
* Metadata management
* Automatic versioning
* Processing status tracking
* OCR support
* Rollback
* Soft delete and recovery
* Authorized downloads using short-lived S3 presigned URLs

---

# Permission-Aware Document Access

Document access is separate from operational permissions.

~~~text
PermissionGrant
→ May the user perform an operation?

DocumentAccessPolicy
→ May the user access this document?
~~~

Access policies can target:

~~~text
ORGANIZATION
UNIT
USER
ROLE
~~~

Policies can be permanent or time-bound:

~~~text
validFrom
validUntil
revokedAt
~~~

Example:

~~~text
July 1 → July 15
Finance only

July 15 → August 1
Finance + Managers

After August 1
Entire organization
~~~

Access changes do not require moving files or rebuilding embeddings.

~~~text
S3 File          → Unchanged
Document Record  → Unchanged
Chunks           → Unchanged
Qdrant Vectors   → Unchanged
Active Policy    → Changes with time
~~~

PostgreSQL remains the authorization authority.

---

# Incremental Indexing

When a document changes, the platform will avoid regenerating embeddings for unchanged content.

~~~text
New Version
→ Extract Content
→ Create Chunks
→ Calculate Content Hashes
→ Compare With Previous Version
→ Reuse Unchanged Chunks
→ Embed Only Changed Chunks
→ Update Qdrant
~~~

Benefits:

* Faster indexing
* Lower embedding cost
* Reduced duplicate processing
* Faster document synchronization

---

# Secure Retrieval Pipeline

Every query passes through a permission-aware retrieval pipeline.

~~~text
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
~~~

The LLM must never receive unauthorized document content.

---

# Qdrant Retrieval Model

Qdrant stores embedding vectors and stable retrieval identifiers.

Example payload:

~~~text
{
    organizationId,
    documentId,
    versionId,
    chunkId,
    isCurrentVersion
}
~~~

Retrieval flow:

~~~text
User Query
→ Resolve Active Access in PostgreSQL
→ Determine Authorized Search Scope
→ Search Qdrant
→ Retrieve Candidate Chunks
→ Validate Authorization Again
→ Rerank
→ Send Authorized Context to LLM
~~~

Frequently changing access policies remain in PostgreSQL rather than being duplicated as the only authorization source across every vector.

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

If sufficient evidence cannot be retrieved, the system refuses to generate an unsupported answer.

---

# Intelligent Query Caching

The platform will use multiple cache layers:

* Exact query cache
* Semantic query cache
* Redis response cache

Before serving cached responses, the system validates:

* Current user access
* Document versions
* Source chunk integrity
* Confidence thresholds
* Verification status

Only cache entries affected by changed documents or access conditions should be invalidated.

---

# Configurable RAG Pipeline

Major pipeline components can be enabled, disabled, or replaced through configuration.

~~~env
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
~~~

Configurable components include:

~~~text
Retrieval
→ Semantic
→ Keyword
→ Hybrid

Embeddings
→ BGE
→ E5
→ MiniLM

Query Processing
→ Query Expansion
→ Metadata Filtering
→ Context Compression

Generation
→ Multiple LLM Providers
→ Streaming
→ Citations

Reliability
→ Hallucination Detection
→ Answer Verification

Performance
→ Redis Caching
→ Background Processing
→ Incremental Indexing
~~~

---

# Performance Optimizations

The project explores:

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

Every major optimization should be benchmarked before and after implementation.

---

# Evaluation Framework

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

## Frontend

* React
* Vite
* Axios
* CSS

## Backend

* Node.js
* Express.js

## Database

* PostgreSQL
* Prisma ORM

## File Storage

* Amazon S3

## AI Services

* FastAPI
* Sentence Transformers
* Lightweight LLMs

## Retrieval Infrastructure

* Qdrant

## Background Processing and Caching

* Redis
* BullMQ

---

# Development Roadmap

~~~text
Phase 1  → Backend Foundation                    ✅
Phase 2  → Authentication                        ✅
Phase 3  → Organization Management               ✅
Phase 4  → Access and Member Management          ✅
Phase 5  → Document Management                   ⏳
Phase 6  → Document Processing                   ⏳
Phase 7  → Retrieval Infrastructure              ⏳
Phase 8  → RAG Pipeline                          ⏳
Phase 9  → Reliability and Caching               ⏳
Phase 10 → Evaluation and Monitoring             ⏳
Phase 11 → Deployment                            ⏳
~~~

---

# Learning Outcomes

This project provides practical experience with:

* Retrieval-Augmented Generation
* Enterprise backend development
* Secure AI systems
* Multi-tenant architecture
* Hierarchy-scoped authorization
* Document lifecycle management
* Amazon S3 object storage
* Vector databases
* Distributed processing
* Asynchronous programming
* Event-driven architecture
* Caching strategies
* Performance optimization
* AI evaluation and benchmarking

---

# Project Philosophy

Every major engineering decision should answer:

1. Why is this needed?
2. How does it improve the system?
3. Can the improvement be measured?

The objective is not to build another chatbot. The goal is to engineer a secure, scalable, explainable, and measurable enterprise knowledge retrieval platform.