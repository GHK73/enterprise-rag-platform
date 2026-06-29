# Enterprise Secure Knowledge Platform (ESKP)

> A production-inspired AI knowledge platform that enables organizations to securely upload, manage, version, and query enterprise documents using Retrieval-Augmented Generation (RAG). The platform focuses on security, scalability, low-latency retrieval, minimal hallucination, and measurable system improvements through configurable AI pipelines.

---

# Motivation

Enterprise organizations generate thousands of confidential documents, including financial reports, legal contracts, HR policies, research papers, and internal documentation.

Finding relevant information is often slow, while traditional AI assistants may:

* Hallucinate unsupported information
* Ignore organization-level permissions
* Expose confidential content
* Return outdated responses after document updates
* Lack transparency regarding information sources

This project aims to solve these challenges by building a secure, configurable, and production-oriented RAG platform.

---

# Core Objectives

* Build an enterprise-grade document intelligence platform.
* Implement a modular RAG pipeline without relying heavily on high-level frameworks.
* Support secure multi-organization document management.
* Reduce hallucinations through retrieval validation and answer verification.
* Learn asynchronous backend development and scalable system design.
* Benchmark every optimization using measurable evaluation metrics.

---

# Key Features

## Enterprise Security

* JWT Authentication
* Organization & Department Management
* Role-Based Access Control (RBAC)
* Permission-aware Retrieval
* Sensitive Information Detection & Masking
* Audit Logging

---

## Document Management

Unlike traditional RAG applications, documents are never overwritten.

The platform maintains a complete version history while supporting incremental updates.

### Capabilities

* Upload documents
* Update existing documents
* Automatic version management
* Document comparison
* Rollback to previous versions
* Soft delete & recovery
* Metadata extraction
* OCR support
* Processing status tracking

---

## Document Versioning

Every uploaded document maintains its own version history.

```
Financial_Report.pdf

Version 1

↓

Version 2

↓

Version 3
```

When a document is updated, only modified sections are reprocessed.

This enables:

* Faster indexing
* Lower embedding cost
* Reduced storage requirements
* Faster document updates

---

## Incremental Indexing

Rather than regenerating embeddings for an entire document, the system compares document chunks using hashing.

```
Updated Document

↓

Compare Chunk Hashes

↓

Changed Chunks

↓

Generate New Embeddings

↓

Update Vector Database
```

Only modified chunks are re-indexed.

---

## Intelligent Query Pipeline

Every user query follows a secure retrieval pipeline.

```
User Question
      │
Authentication
      │
Permission Validation
      │
Generate Embedding
      │
┌───────────────┬────────────────┐
│               │                │
Semantic Search Keyword Search Metadata Filter
│               │                │
└───────────────┴────────────────┘
        │
Merge Results
        │
Reranker
        │
Hallucination Check
        │
Answer Verification
        │
Citation Generation
        │
Response
```

---

## Hallucination Prevention

The platform prioritizes correctness over generating uncertain responses.

Implemented techniques include:

* Hybrid Retrieval
* Context Validation
* Confidence Thresholds
* Answer Verification
* Citation Generation
* Permission-aware Context Filtering

If sufficient supporting evidence is unavailable, the assistant refuses to answer instead of generating unsupported information.

---

## Intelligent Query Caching

Repeated questions are optimized through multiple cache layers.

### Cache Levels

* Exact Query Cache
* Semantic Question Cache
* Redis Response Cache

Before returning a cached response, the system verifies:

* User permissions
* Document version
* Source chunk validity
* Confidence threshold
* Answer verification status

Whenever a document is updated, only affected cached responses are invalidated.

---

## Configurable AI Pipeline

Every major component of the retrieval pipeline can be enabled, disabled, or replaced using configuration.

Examples include:

* Search Strategy

  * Semantic Search
  * Keyword Search
  * Hybrid Search

* Embedding Model

  * BGE
  * E5
  * MiniLM

* Cache Strategy

  * None
  * Redis
  * Semantic Cache

* Reranking

  * Enabled
  * Disabled

* Query Expansion

* Streaming Responses

* Hallucination Detection

* Incremental Indexing

This modular architecture allows rapid experimentation without modifying application code.

---

# Performance & Optimization

The project is designed to explore production optimization techniques including:

* Redis Caching
* BullMQ Workers
* Background Processing
* Parallel Execution
* Promise.all()
* Promise.allSettled()
* Event-Driven Architecture
* Streaming Responses
* Incremental Embedding Updates

---

# Evaluation Framework

Every optimization introduced into the system is benchmarked before and after implementation.

### Retrieval Metrics

* Recall@K
* Precision@K
* Mean Reciprocal Rank (MRR)
* Hit Rate

### Generation Metrics

* Faithfulness
* Answer Relevancy
* Hallucination Rate
* Citation Accuracy

### Performance Metrics

* Average Response Time
* Retrieval Latency
* Embedding Time
* LLM Latency
* Cache Hit Rate
* Throughput
* Token Usage
* Cost Reduction

The objective is to quantify every engineering decision rather than relying on qualitative improvements.

---

# Technology Stack

### Frontend

* React
* Tailwind CSS

### Backend

* Node.js
* Express.js

### Database

* PostgreSQL
* Prisma ORM

### AI Services

* FastAPI
* Sentence Transformers
* Lightweight LLMs

### Infrastructure

* Redis
* BullMQ
* Qdrant
* MinIO (Object Storage)

---

# Learning Outcomes

This project is designed to provide hands-on experience with:

* Enterprise Backend Development
* Distributed AI Systems
* Retrieval-Augmented Generation
* Vector Databases
* Secure API Design
* Database Design
* Asynchronous Programming
* Parallel Processing
* Event-Driven Architecture
* Caching Strategies
* Production System Design
* Performance Optimization
* AI Evaluation & Benchmarking

---

# Project Philosophy

Every new feature introduced into the platform must answer three questions:

1. Why is this feature required?
2. How does it improve the system?
3. Can the improvement be measured?

The primary goal is not to build another chatbot, but to engineer a secure, scalable, explainable, and measurable enterprise AI platform.


# Environment-Driven Configuration

The platform is designed to be highly configurable using **environment variables**, allowing features to be enabled, disabled, or swapped without modifying application code.

This approach enables rapid experimentation, simpler deployments, and reproducible performance benchmarks across different environments.

---

## Configurable Components

Every major subsystem can be controlled through the `.env` file.

### Retrieval

* Semantic Search
* Keyword Search
* Hybrid Search

### Caching

* Redis Cache
* Exact Query Cache
* Semantic Cache
* Embedding Cache
* LLM Response Cache

### AI Pipeline

* Embedding Model Selection
* LLM Provider
* Query Expansion
* Reranking
* Hallucination Detection
* Answer Verification
* Citation Generation

### Document Processing

* OCR Support
* Incremental Indexing
* Background Processing
* Streaming Responses

### Monitoring

* Audit Logging
* Metrics Collection
* Performance Tracking

---

## Example Configuration

```env
# Retrieval Strategy
RETRIEVAL_MODE=hybrid

# Redis
REDIS_ENABLED=true

# Caching
QUERY_CACHE_ENABLED=true
SEMANTIC_CACHE_ENABLED=true

# Reranker
RERANKER_ENABLED=true

# Query Expansion
QUERY_EXPANSION_ENABLED=false

# Hallucination Detection
HALLUCINATION_CHECK_ENABLED=true

# Incremental Indexing
INCREMENTAL_INDEXING_ENABLED=true

# Streaming Responses
STREAMING_ENABLED=true

# OCR
OCR_ENABLED=false

# Metrics
METRICS_ENABLED=true

# Audit Logging
AUDIT_LOGGING_ENABLED=true

# Embedding Model
EMBEDDING_MODEL=bge-small-en

# LLM
LLM_PROVIDER=llama
```

---

## Why Environment-Based Configuration?

Using environment variables provides several advantages:

* No code changes are required to enable or disable features.
* Different environments (development, testing, and production) can use different configurations.
* Engineering optimizations can be benchmarked independently.
* New components can be introduced without affecting existing business logic.
* Experimental features can be safely evaluated before production deployment.

---

## Benchmarking Optimizations

Because every optimization can be controlled independently, the platform can measure the impact of each engineering decision.

Example experiments include:

* Redis Enabled vs Disabled
* Hybrid Search vs Semantic Search
* Reranking Enabled vs Disabled
* Incremental Indexing vs Full Re-indexing
* Streaming vs Standard Responses
* Different Embedding Models
* Different LLM Providers

For every experiment, the system records metrics such as:

* Average Response Time
* Retrieval Latency
* Cache Hit Rate
* Recall@K
* Precision@K
* Mean Reciprocal Rank (MRR)
* Hallucination Rate
* Citation Accuracy
* Token Usage
* Cost Reduction

This environment-driven architecture makes the platform modular, production-friendly, and suitable for evaluating real-world engineering trade-offs through measurable results.
