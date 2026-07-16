# Enterprise RAG AI Service Development Log

Implementation progress for the Enterprise RAG Platform AI Service.

Backend reference: [`../backend/docs/DEVELOPMENT.md`](../backend/docs/DEVELOPMENT.md)

---

# Current Status

**Active Phase:** Phase 1 — AI Service Foundation

| Area | Status |
| --- | --- |
| FastAPI Foundation | ⏳ |
| Configuration | ⏳ |
| Document Processing API | ⏳ |
| Document Extraction | ⏳ |
| OCR Support | ⏳ |
| Chunk Generation | ⏳ |
| Embedding Generation | ⏳ |
| Vector Indexing | ⏳ |
| Retrieval Pipeline | ⏳ |
| RAG Pipeline | ⏳ |

---

# Purpose

The AI Service is responsible for all AI-specific workloads within the Enterprise RAG Platform.

Unlike the backend, it does not manage authentication, authorization, or business state.

Its responsibilities include:

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

The backend remains the source of truth for authorization.

---

# Service Architecture

```text
Node.js Backend
        │
        ▼
FastAPI AI Service
        │
        ├── Extraction
        ├── OCR
        ├── Chunking
        ├── Embeddings
        ├── Vector Search
        ├── Reranking
        └── Answer Generation
```

---

# Current Architecture

```text
Backend
        │
        ▼
Processing Dispatcher
        │
        ▼
FastAPI
        │
        ▼
Processing Service
```

The service will gradually evolve as additional processing stages are implemented.

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
| EMBEDDING_MODEL | SentenceTransformer model |
| QDRANT_URL | Vector database URL |
| QDRANT_API_KEY | Qdrant authentication |

---

# Planned Development

## Phase 1 — AI Service Foundation ⏳

Implemented goals:

- FastAPI application
- Configuration management
- Health endpoint
- Logging
- Request validation
- Error handling

---

## Phase 2 — Document Processing ⏳

Goals:

```text
Upload
        ↓
Validate
        ↓
Extract Content
        ↓
Normalize
```

Implemented goals:

- Processing endpoint
- File validation
- Processing pipeline
- Temporary storage

---

## Phase 3 — Content Extraction ⏳

Supported formats:

```text
PDF
DOCX
TXT
```

Implemented goals:

- PyMuPDF integration
- DOCX extraction
- Plain text extraction
- Metadata extraction

---

## Phase 4 — OCR ⏳

Goals:

```text
Image Detection
        ↓
OCR
        ↓
Merge Content
```

Implemented goals:

- OCR fallback
- Scanned PDF support
- Image extraction

---

## Phase 5 — Chunk Generation ⏳

Pipeline

```text
Text
        ↓
Cleaning
        ↓
Normalization
        ↓
Chunk Generation
```

Implemented goals:

- Recursive chunking
- Configurable overlap
- Metadata preservation
- Section-aware chunking

---

## Phase 6 — Embedding Generation ⏳

Pipeline

```text
Chunks
        ↓
Sentence Transformer
        ↓
Embeddings
```

Implemented goals:

- Batch embeddings
- GPU support
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

Implemented goals:

- Collection creation
- Incremental indexing
- Metadata indexing
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
Hybrid Search
        ↓
Reranking
```

Implemented goals:

- Semantic retrieval
- Metadata filtering
- Hybrid retrieval
- Cross-encoder reranking

---

## Phase 9 — Retrieval-Augmented Generation ⏳

Pipeline

```text
Retrieved Chunks
        ↓
Context Validation
        ↓
Prompt Construction
        ↓
LLM
        ↓
Grounded Response
```

Implemented goals:

- Prompt templates
- Context reconstruction
- Citation metadata
- Streaming responses

---

## Phase 10 — Evaluation ⏳

Implemented goals:

- Retrieval metrics
- Embedding quality
- Hallucination evaluation
- Citation validation
- Latency monitoring

---

# Planned API

## Health

```text
GET /api/v1/health
```

---

## Processing

```text
POST /api/v1/process-document
GET  /api/v1/process/:documentId
```

---

## Retrieval

```text
POST /api/v1/retrieve
```

---

## Generation

```text
POST /api/v1/generate
```

---

# Planned Project Structure

```text
ai-service/
│
├── app/
│   ├── api/
│   ├── config/
│   ├── schemas/
│   ├── services/
│   │   ├── extraction/
│   │   ├── chunking/
│   │   ├── embedding/
│   │   ├── retrieval/
│   │   ├── reranking/
│   │   ├── generation/
│   │   └── vector/
│   │
│   ├── utils/
│   └── main.py
│
├── tests/
│
├── requirements.txt
└── README.md
```

---

# Engineering Principles

The AI Service never decides authorization.

```text
Backend
        ↓
Authorization
        ↓
Authorized Documents
        ↓
AI Service
```

Only content already approved by the backend may be processed or retrieved.

The AI Service is stateless.

Persistent application state remains within PostgreSQL and Qdrant.

---

# Next Development Step

## Phase 1 — AI Service Foundation

Backend Integration

```text
Node.js Backend
        ↓
HTTP Request
        ↓
FastAPI
        ↓
Health Endpoint
```

Once the service foundation is complete, document processing endpoints will be implemented and integrated with the backend processing pipeline.