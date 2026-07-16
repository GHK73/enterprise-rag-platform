# Enterprise RAG AI Service Development Log

Implementation progress for the Enterprise RAG Platform AI Service.

Backend reference: [`../backend/docs/DEVELOPMENT.md`](../backend/docs/DEVELOPMENT.md)

---

# Current Status

**Active Phase:** Phase 2 — Document Processing

| Area | Status |
| --- | --- |
| FastAPI Foundation | ✅ |
| Configuration | ✅ |
| Logging & Validation | ✅ |
| Health Endpoint | ✅ |
| Document Processing API | ✅ |
| Download Pipeline | ✅ |
| Content Extraction | 🚧 |
| OCR Support | ⏳ |
| Chunk Generation | 🚧 |
| Embedding Generation | ⏳ |
| Vector Indexing | ⏳ |
| Retrieval Pipeline | ⏳ |
| RAG Pipeline | ⏳ |

---

# Purpose

The AI Service handles all AI-specific workloads for the Enterprise RAG Platform.

Unlike the backend, it is responsible only for document understanding and retrieval. Authentication, authorization, business logic, and application state remain the responsibility of the backend.

Responsibilities include:

- Document processing
- Content extraction
- OCR
- Text normalization
- Chunk generation
- Embedding generation
- Vector indexing
- Retrieval
- Reranking
- Prompt construction
- LLM interaction

---

# Architecture

```text
Node.js Backend
        │
        ▼
FastAPI AI Service
        │
        ├── Document Processing
        ├── Content Extraction
        ├── OCR
        ├── Chunk Generation
        ├── Embedding Generation
        ├── Vector Indexing
        ├── Retrieval
        ├── Reranking
        └── Answer Generation
```

The service grows incrementally as additional processing stages are implemented.

---

# Local Setup

```bash
cd ai-service

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

# Environment Variables

| Variable | Purpose |
| --- | --- |
| APP_NAME | Service name |
| APP_VERSION | API version |
| ENVIRONMENT | Development / Production |
| HOST | Service host |
| PORT | Service port |
| LOG_LEVEL | Logging level |
| EMBEDDING_MODEL | Sentence Transformer model |
| QDRANT_URL | Vector database |
| QDRANT_API_KEY | Qdrant authentication |

---

# Development Phases

## Phase 1 — AI Service Foundation ✅

Completed:

- FastAPI application
- Configuration management
- Structured logging
- Global exception handling
- Request validation
- Health endpoint
- API routing
- Service lifecycle

---

## Phase 2 — Document Processing 🚧

Pipeline

```text
Upload
        ↓
Validate
        ↓
Download
        ↓
Extract
        ↓
Normalize
```

Current Progress

- Processing endpoint
- Request validation
- Temporary workspace
- Document downloader
- Processing service
- Processing pipeline orchestration

Remaining

- Processing status tracking
- Retry handling
- Processing metrics

---

## Phase 3 — Content Extraction 🚧

Supported Formats

- PDF
- DOCX
- TXT

Current Progress

- Extraction service
- Format detection
- PDF extractor
- DOCX extractor
- TXT extractor

Planned

- Metadata extraction
- Table extraction
- Image extraction
- Page information
- Scanned document detection

---

## Phase 4 — OCR ⏳

Pipeline

```text
Document
        ↓
Image Detection
        ↓
OCR
        ↓
Merge Content
```

Planned Features

- OCR fallback
- Scanned PDF support
- Image text extraction
- OCR preprocessing

---

## Phase 5 — Chunk Generation 🚧

Pipeline

```text
Extracted Text
        ↓
Normalization
        ↓
Chunk Generation
```

Current Progress

- Text normalization
- Configurable chunk size
- Chunk overlap
- Chunk metadata

Planned

- Recursive chunking
- Section-aware chunking
- Paragraph-aware chunking
- Token-aware chunking

## Phase 6 — Embedding Generation ⏳

Pipeline

```text
Chunks
        ↓
Embedding Model
        ↓
Vector Embeddings
```

Planned Features

- Sentence Transformer integration
- Batch embedding generation
- GPU acceleration
- CPU fallback
- Embedding metadata

---

## Phase 7 — Vector Indexing ⏳

Pipeline

```text
Embeddings
        ↓
Qdrant
```

Planned Features

- Collection management
- Incremental indexing
- Document re-indexing
- Metadata synchronization
- Version replacement

---

## Phase 8 — Retrieval ⏳

Pipeline

```text
User Query
        ↓
Embedding
        ↓
Vector Search
        ↓
Metadata Filtering
        ↓
Reranking
```

Planned Features

- Semantic retrieval
- Hybrid retrieval
- Permission-aware filtering
- Cross-encoder reranking

---

## Phase 9 — Retrieval-Augmented Generation ⏳

Pipeline

```text
Retrieved Chunks
        ↓
Prompt Construction
        ↓
LLM
        ↓
Grounded Response
```

Planned Features

- Prompt templates
- Context reconstruction
- Citation metadata
- Streaming responses
- Hallucination reduction

---

## Phase 10 — Evaluation & Monitoring ⏳

Planned Features

- Retrieval evaluation
- Embedding quality
- Citation validation
- Latency monitoring
- Processing metrics
- AI service monitoring

---

# API

## Health

```text
GET     /api/v1/health
```

---

## Processing

```text
POST    /api/v1/process-document
GET     /api/v1/process/:documentId
```

---

## Retrieval

```text
POST    /api/v1/retrieve
```

---

## Generation

```text
POST    /api/v1/generate
```

---

# Engineering Principles

The AI Service never determines authorization.

```text
Backend
        ↓
Authentication
        ↓
Authorization
        ↓
Authorized Documents
        ↓
AI Service
```

Only content approved by the backend is processed or retrieved.

The AI Service is stateless.

Persistent application state remains in:

- PostgreSQL (application data)
- Qdrant (vector index)

The processing pipeline is modular so that extraction, OCR, chunking, embeddings, retrieval, and generation can evolve independently without changing the overall architecture.

---

# Next Development Step

## Current Focus

```text
Download
        ↓
Extraction
        ↓
Normalization
        ↓
Chunk Generation
```

Next milestones:

- Complete content extraction
- Improve chunk generation
- Implement embedding generation
- Integrate Qdrant
- Build retrieval pipeline

Once embedding generation and vector indexing are complete, the AI service will be capable of processing enterprise documents for semantic retrieval, enabling Phase 8 (Retrieval) and Phase 9 (Retrieval-Augmented Generation).