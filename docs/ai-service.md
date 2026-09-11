# Enterprise RAG AI Service Development Log
Implementation progress for the Enterprise RAG Platform AI Service.
Backend reference: [`../backend/docs/DEVELOPMENT.md`](../backend/docs/DEVELOPMENT.md)
---
# Current Status
**Active Phase:** Phase 7 — Vector Indexing
| Area | Status |
| --- | --- |
| FastAPI Foundation | ✅ |
| Configuration | ✅ |
| Logging & Validation | ✅ |
| Health Endpoint | ✅ |
| Document Processing API | ✅ |
| Download Pipeline | ✅ |
| Content Extraction | 🚧 |
| Document Normalization | 🚧 |
| Chunk Generation | 🚧 |
| OCR Support | ⏳ |
| Embedding Generation | ✅ |
| Vector Indexing | 🚧 |
| Retrieval Pipeline | ⏳ |
| RAG Pipeline | ⏳ |
---
# Purpose
The AI Service is responsible for all AI-related workloads within the Enterprise RAG Platform.
Unlike the backend, it does not manage authentication, authorization, organizations, or business logic. Those responsibilities remain entirely within the backend.
The AI Service focuses on understanding enterprise documents and enabling semantic retrieval through modular AI pipelines.
Core responsibilities include:
- Document processing
- Content extraction
- OCR
- Document normalization
- Chunk generation
- Embedding generation
- Vector indexing
- Semantic retrieval
- Reranking
- Prompt construction
- LLM interaction
---
# High-Level Architecture
```text
                    Enterprise RAG Platform
                 +---------------------------+
                 |      Node.js Backend      |
                 +---------------------------+
                              │
                  Authentication / Authorization
                              │
                     Document & Permission APIs
                              │
                              ▼
                 +---------------------------+
                 |     FastAPI AI Service    |
                 +---------------------------+
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
       Document          Embedding         Retrieval
       Processing         Generation        Pipeline
             │                │                │
             └────────────────┼────────────────┘
                              │
                              ▼
                       Qdrant Cloud
                              │
                              ▼
                       Grounded Response
```
---
# Local Development
```bash
cd ai-service
python -m venv venv
venv\Scriptsctivate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
---
# Environment Variables
| Variable | Purpose |
| --- | --- |
| APP_NAME | AI Service name |
| APP_VERSION | Service version |
| ENVIRONMENT | Development / Production |
| HOST | Server host |
| PORT | Server port |
| LOG_LEVEL | Logging level |
| EMBEDDING_MODEL | Sentence Transformer model |
| QDRANT_URL | Qdrant Cloud cluster URL |
| QDRANT_API_KEY | Qdrant Cloud authentication |
| QDRANT_COLLECTION | Qdrant Cloud collection name |
---
# Development Roadmap
## Phase 1 — AI Service Foundation ✅
### Goal
Establish a production-ready FastAPI service that integrates with the Enterprise RAG backend.
### Completed
- FastAPI application setup
- Project structure
- Configuration management
- Environment loading
- Structured logging
- Exception handling
- Request validation
- Health endpoint
- API routing
- Service lifecycle management
---
## Phase 2 — Document Processing 🚧
### Goal
Build the document processing pipeline responsible for preparing uploaded documents for AI workloads.
### Completed
- Processing API
- Request validation
- Temporary workspace
- Document download pipeline
- Processing service
- Pipeline orchestration
- Extraction integration
- Normalization integration
- Chunking integration
- Embedding integration
- Qdrant indexing integration
### In Progress
- Processing status management
- Retry handling
- Processing metrics
- End-to-end processing verification
---
## Phase 3 — Content Extraction 🚧
### Goal
Extract structured information from enterprise documents while preserving layout and metadata.
### Supported Formats
- PDF
- DOCX
- TXT
### Completed
- Base extractor
- PDF extractor
- DOCX extractor
- TXT extractor
- Table extraction module
- Docling integration
- Extraction orchestration
### Planned
- Metadata enhancement
- Image extraction
- Figure extraction
- Formula extraction
- Chart detection
- Page layout preservation
- Reading order reconstruction
---
## Phase 4 — OCR ⏳
### Goal
Support scanned documents and image-based PDFs.
### Planned
- OCR fallback
- Scanned PDF detection
- Image preprocessing
- OCR text extraction
- OCR confidence scoring
- Reading order merging
---
## Phase 5 — Chunk Generation 🚧
### Goal
Convert extracted content into retrieval-ready chunks while preserving document structure.
### Completed
- Content normalization
- Configurable chunk size
- Chunk overlap
- Chunk metadata
- Deterministic chunk IDs
- Oversized chunk handling
### Planned
- Recursive chunking
- Section-aware chunking
- Paragraph-aware chunking
- Table-aware chunking
- Token-aware chunking
- Semantic chunk optimization
---
## Phase 6 — Embedding Generation ✅
### Goal
Generate high-quality vector embeddings from document chunks for semantic search.
### Completed
- Sentence Transformers integration
- `all-MiniLM-L6-v2` embedding model
- Batch embedding generation
- GPU detection
- CPU fallback
- Normalized embeddings
- Automatic embedding dimension detection
- Chunk embedding generation
- Embedding integration with document processing
### Current Configuration
```text
Model: all-MiniLM-L6-v2
Vector Size: 384
Normalization: Enabled
```
### Planned Improvements
- Embedding caching
- Batch processing optimization
- Additional embedding model evaluation
- Embedding performance monitoring
---
## Phase 7 — Vector Indexing 🚧
### Goal
Store document embeddings in Qdrant Cloud for efficient semantic retrieval.
### Completed
- Qdrant Cloud configuration
- Qdrant Cloud authentication
- Async Qdrant client integration
- Collection existence checking
- Collection creation
- Dynamic vector dimension configuration
- Cosine similarity configuration
- Deterministic Qdrant point IDs
- Chunk payload construction
- Batch upsert implementation
- Qdrant Cloud connection verification
- Vector search implementation
- Integration with document processing pipeline
### Current Qdrant Structure
Each indexed chunk stores:
```text
Point
├── Vector
└── Payload
    ├── document_id
    ├── version_id
    ├── chunk_id
    ├── page_number
    ├── text
    ├── block_ids
    └── metadata
```
### Current Vector Configuration
```text
Database: Qdrant Cloud
Collection: QDRANT_COLLECTION
Embedding Model: all-MiniLM-L6-v2
Vector Size: 384
Distance: COSINE
```
### Current Indexing Flow
```text
Document
   ↓
Download
   ↓
Extraction
   ↓
Normalization
   ↓
Chunking
   ↓
Embedding Generation
   ↓
Qdrant Cloud
   ↓
Batch Upsert
```
### Remaining Work
- End-to-end indexing verification with a real document
- Verify stored points and payloads
- Verify vector search against indexed chunks
- Incremental indexing
- Re-indexing support
- Metadata synchronization
- Version replacement
- Deleted document handling
- Indexing failure recovery
- Batch and collection optimization
---
## Phase 8 — Retrieval Pipeline ⏳
### Goal
Retrieve the most relevant document chunks for a given query.
### Planned
- Query embedding generation
- Semantic vector search
- Metadata filtering
- Permission-aware retrieval
- Hybrid search
- Cross-encoder reranking
- Similarity score normalization
- Top-k retrieval optimization
---
## Phase 9 — Retrieval-Augmented Generation ⏳
### Goal
Generate grounded responses using retrieved enterprise knowledge.
### Planned
- Prompt templates
- Context reconstruction
- Citation generation
- Source attribution
- Streaming responses
- Hallucination reduction
- Multi-document context support
- Conversation history integration
---
## Phase 10 — Evaluation & Monitoring ⏳
### Goal
Measure system quality, retrieval accuracy, and production performance.
### Planned
- Processing metrics
- Retrieval evaluation
- Embedding quality evaluation
- Citation validation
- Latency monitoring
- Error tracking
- AI service monitoring
- Performance dashboards
---
# API Endpoints
## Health
```text
GET    /api/v1/health
```
## Document Processing
```text
POST   /api/v1/process-document
GET    /api/v1/process/:documentId
```
## Retrieval
```text
POST   /api/v1/retrieve
```
## Generation
```text
POST   /api/v1/generate
```
---
# Processing Workflow
```text
Upload Document
        │
        ▼
Validation
        │
        ▼
Download
        │
        ▼
Content Extraction
        │
        ▼
Normalization
        │
        ▼
Chunk Generation
        │
        ▼
Embedding Generation
        │
        ▼
Vector Indexing (Qdrant Cloud)
        │
        ▼
Semantic Retrieval
        │
        ▼
Prompt Construction
        │
        ▼
LLM Response
```
---
# Engineering Principles
### Backend Owns Authorization
The AI Service never authenticates users or determines document permissions.
```text
Client
   │
   ▼
Backend Authentication
   │
   ▼
Backend Authorization
   │
   ▼
Authorized Documents
   │
   ▼
AI Service
```
Only documents explicitly authorized by the backend are processed or retrieved.
The backend remains the source of truth for authorization. Qdrant is only used for vector indexing and retrieval infrastructure.
### Stateless Architecture
The AI Service remains stateless.
Persistent data is stored externally.
| Component | Storage |
| --- | --- |
| Application Data | PostgreSQL |
| Vector Embeddings | Qdrant Cloud |
| Document Storage | Backend / Object Storage |
### Modular Design
Each processing stage is isolated and independently replaceable.
```text
Downloader
     │
     ▼
Extractors
     │
     ▼
Normalization
     │
     ▼
Chunking
     │
     ▼
Embeddings
     │
     ▼
Vector Indexing
     │
     ▼
Retrieval
     │
     ▼
Generation
```
This modular architecture allows individual components to evolve without affecting the overall system.
---
# Current Progress
## Completed
- FastAPI service foundation
- Configuration management
- Structured logging
- Health endpoint
- Document processing API
- Download pipeline
- Content extraction components
- Content normalization
- Chunk generation
- Deterministic chunk IDs
- Embedding generation
- Sentence Transformer integration
- Batch embedding generation
- GPU / CPU device selection
- Normalized embeddings
- Qdrant Cloud configuration
- Qdrant Cloud connection
- Qdrant collection management
- Qdrant chunk indexing implementation
- Qdrant vector search implementation
- Embedding-to-Qdrant processing integration
## Current Focus
- End-to-end Qdrant indexing verification
- Verify stored vectors and payloads
- Verify vector search using real document chunks
- Complete remaining Phase 7 indexing features
- Prepare permission-aware retrieval
## Upcoming Milestones
1. End-to-end Qdrant indexing verification
2. Incremental indexing
3. Re-indexing and version replacement
4. Retrieval pipeline
5. Permission-aware retrieval
6. Hybrid retrieval
7. Reranking
8. Retrieval-Augmented Generation
9. Evaluation and monitoring
---
# Long-Term Vision
The Enterprise RAG AI Service is designed as a modular, production-ready AI platform capable of processing large-scale enterprise knowledge bases while supporting secure, permission-aware semantic retrieval and grounded response generation.
Each phase builds incrementally on the previous one, enabling independent evolution of extraction, chunking, embeddings, indexing, retrieval, and generation without requiring architectural changes.
