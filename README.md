# Enterprise Secure Knowledge Platform

> A production-inspired AI knowledge platform that enables organizations to securely upload, manage, version, and query enterprise documents using Retrieval-Augmented Generation (RAG) while enforcing access control, minimizing hallucinations, and providing measurable system improvements.

---

## Document Lifecycle Management

The platform maintains complete document history instead of overwriting existing files.

### Features

* Upload new documents
* Update existing documents
* Automatic version management
* Version history
* Rollback to previous versions
* Incremental indexing
* Document status tracking
* Soft delete and recovery

### Document Workflow

```
Upload Document
        │
        ▼
Create Version 1
        │
        ▼
Extract Metadata
        │
        ▼
Chunk Document
        │
        ▼
Generate Embeddings
        │
        ▼
Store in Vector Database
```

---

## Document Updates

When a document is updated, the system does **not** recreate the entire index.

Instead, it performs incremental processing.

```
Upload Updated Document
        │
        ▼
Compare with Previous Version
        │
        ▼
Detect Changed Chunks
        │
 ┌──────┴────────┐
 │               │
Unchanged    Modified
Chunks        Chunks
 │               │
Skip      Generate New Embeddings
 │               │
 └──────┬────────┘
        │
Update Vector Database
```

Benefits

* Faster indexing
* Lower embedding cost
* Reduced storage usage
* Better scalability

---

## Version History

Every uploaded document maintains its own history.

Example

```
Financial_Report.pdf

Version 1
Uploaded: Jan 10

↓

Version 2
Uploaded: Feb 18

↓

Version 3
Uploaded: Mar 27
```

Users can

* View previous versions
* Compare versions
* Restore older versions
* Track changes

---

## Incremental Indexing

Each document is divided into chunks.

Every chunk stores

* Chunk ID
* Document ID
* Version Number
* Hash
* Embedding
* Metadata

When a document is updated

```
Old Version

Chunk A

Chunk B

Chunk C

↓

New Version

Chunk A

Chunk B (Modified)

Chunk C
```

Only **Chunk B** receives a new embedding.

Unchanged chunks remain untouched.

---

## Cache Invalidation

Generated answers always store

* Document Version
* Chunk IDs
* Source Documents

When a document changes

```
Document Updated

↓

Changed Chunks Identified

↓

Affected Cached Answers Invalidated

↓

Next Query Generates Fresh Response
```

This guarantees users never receive stale answers.

---

## Document Metadata

Each document stores

* Organization
* Department
* Owner
* Classification
* Current Version
* Previous Versions
* Upload Timestamp
* Last Modified
* Status
* Processing State

---

## Planned Enterprise Features

### Security

* JWT Authentication
* Role-Based Access Control
* Department Isolation
* Organization Isolation
* Sensitive Data Detection
* Audit Logging

### Document Management

* Upload Documents
* Update Documents
* Version History
* Incremental Indexing
* Soft Delete
* Document Comparison
* Metadata Extraction
* OCR Support

### AI Features

* Semantic Search
* Hybrid Retrieval
* Cross-Encoder Reranking
* Citation Generation
* Confidence Scoring
* Hallucination Reduction
* Answer Verification

### Performance

* Redis Cache
* BullMQ Workers
* Parallel Processing
* Streaming Responses
* Background Jobs
* Incremental Embedding Updates

### Evaluation

Every optimization is benchmarked using

* Recall@K
* Precision@K
* MRR
* Faithfulness
* Answer Relevancy
* Hallucination Rate
* Retrieval Latency
* LLM Latency
* Cache Hit Rate
* Throughput

---

## Engineering Goals

This project focuses on learning real-world backend and AI engineering concepts, including:

* Enterprise System Design
* MERN Stack Development
* FastAPI Integration
* Vector Databases
* Retrieval-Augmented Generation (RAG)
* Async/Await
* Promise.all()
* Promise.allSettled()
* Worker Queues
* Redis
* Event-Driven Architecture
* Incremental Processing
* Version Control for Documents
* Performance Optimization
* Production-Grade API Design


## Configuration & Feature Flags

The platform is designed to be modular and configurable. Core features can be enabled, disabled, or switched through environment variables without modifying the source code.

This allows easy experimentation, benchmarking, and performance comparison between different RAG pipeline configurations.

### Configurable Features

| Feature                 | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| Redis Cache             | Enable or disable response caching                    |
| Hybrid Search           | Switch between semantic, keyword, or hybrid retrieval |
| Reranker                | Enable cross-encoder reranking                        |
| Query Expansion         | Improve retrieval using rewritten queries             |
| Semantic Q&A Cache      | Reuse answers for semantically similar questions      |
| Streaming Responses     | Stream LLM responses to the client                    |
| Citations               | Attach document and page references to answers        |
| Hallucination Detection | Validate answers against retrieved context            |
| Answer Verification     | Verify generated responses before returning them      |
| Metadata Filtering      | Filter retrieved documents using metadata             |
| Document Versioning     | Maintain multiple versions of uploaded documents      |
| Incremental Indexing    | Re-embed only modified document chunks                |
| Experiment Logging      | Automatically record benchmark results                |

### Retrieval Strategies

The retrieval pipeline is configurable and supports multiple search strategies.

* Semantic Search
* Keyword Search (BM25)
* Hybrid Search (Semantic + Keyword)

### Embedding Models

Different embedding models can be evaluated without changing the application logic.

Examples:

* BGE Small
* E5 Small
* MiniLM

### Cache Strategies

The platform supports multiple caching mechanisms.

* No Cache
* Redis Cache
* Semantic Question Cache

### Experimentation

Feature flags make it possible to benchmark different configurations and compare their impact on retrieval quality, latency, and hallucination rate.

Example experiments include:

* Semantic Search vs Hybrid Search
* Reranker Enabled vs Disabled
* Redis Cache Enabled vs Disabled
* Different Embedding Models
* Incremental Indexing vs Full Re-indexing

Each experiment can be evaluated using metrics such as:

* Recall@K
* Precision@K
* Mean Reciprocal Rank (MRR)
* Faithfulness
* Hallucination Rate
* Average Response Time
* Retrieval Latency
* LLM Latency
* Cache Hit Rate
* Throughput

This modular architecture enables rapid experimentation while keeping the core application unchanged, making it easier to analyze the effectiveness of each optimization independently.

## Intelligent Query Caching

The platform optimizes repeated queries using a multi-level caching strategy to reduce response time, minimize LLM usage, and lower operational costs.

Instead of invoking the LLM for every request, the system first checks whether a suitable response already exists.

### Query Processing Flow

```
User Question
      │
      ▼
Exact Cache Lookup
      │
      ▼
Semantic Similarity Check
      │
      ▼
Permission Validation
      │
      ▼
Document Version Validation
      │
      ▼
Use Cached Response
      │
      ▼
Otherwise Run Full RAG Pipeline
```

### Cache Levels

#### Level 1 – Exact Query Cache

Stores responses for identical questions.

Example:

```
Question:
"What is the revenue for 2025?"

↓

Return cached response immediately.
```

---

#### Level 2 – Semantic Query Cache

Detects semantically similar questions using embeddings.

Examples:

* What is EBITDA?
* Explain EBITDA.
* Define EBITDA.
* Can you describe EBITDA?

If a high-confidence cached response exists and all validation checks pass, the cached response is returned without invoking the LLM.

---

### Cache Validation

A cached response is returned only if all of the following conditions are satisfied:

* User has permission to access the underlying documents.
* Document version has not changed.
* Cached answer passed answer verification.
* Confidence score exceeds the configured threshold.
* Source chunks remain valid.

Otherwise, the system executes the complete RAG pipeline and refreshes the cache.

---

### Cache Invalidation

Cached responses are automatically invalidated when:

* A source document is updated.
* A new document version is uploaded.
* Referenced chunks are modified.
* User permissions change.
* Cached content expires.

This ensures users always receive responses based on the latest authorized information.

---

### Performance Metrics

The effectiveness of query caching is measured using:

* Cache Hit Rate
* Semantic Cache Hit Rate
* Average Response Time
* LLM Calls Avoided
* Token Savings
* Cost Reduction
* Cache Invalidation Count
* Average Cache Retrieval Time

This optimization significantly reduces latency while maintaining answer freshness, security, and correctness.
