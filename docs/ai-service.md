# AI Service Handoff

Copy this document into a new AI chat when working on the AI service.

## Project Context

This repository is an enterprise RAG platform with three applications:

```text
frontend/    React + Vite user interface
backend/     Node.js + Express API, Prisma, S3, Redis/BullMQ
ai-service/  FastAPI document-processing and vector-indexing service
```

The AI service lives in `ai-service/`. Its purpose is to convert documents into Qdrant vectors and provide candidate retrieval. It does not perform authorization or RAG generation itself; the backend applies document-access policies after retrieval and before any LLM use.

## Architecture Overview

### Request Flow

```text
Backend (Node.js)
  → POST /api/v1/process-document { document_id, version_id, organization_id, file_url }
    → AI Service (FastAPI)
      → Download file from presigned URL (httpx, 60s timeout)
      → Extract content (primary extractor → Docling fallback)
      → Normalize blocks (text, table, image)
      → Chunk content (page-by-page, character-based)
      → Generate embeddings (Sentence Transformer)
      → Upsert into Qdrant (version-aware deterministic point IDs)
      → Cleanup temporary workspace
    ← ProcessDocumentResponse { success, message, document_id, version_id }
```

### Retrieval Flow

```text
Backend Query (POST /api/v1/query)
  → AI Service (FastAPI)
    → POST /api/v1/retrieve { query, organization_id, top_k }
      → RetrievalService.retrieve_candidates(RetrievalRequest)
        → Embed query text
        → Search Qdrant by vector (candidate_limit = min(top_k * 5, 200))
        → Return RetrievalResult[] with scores and metadata
    ← RetrievalResponse { query, results[] }
  → Backend authorizes document_ids via policy checks
  → Backend filters candidates to authorized documents
  → Backend reranks and generates answer with LLM
```

The AI service intentionally retrieves **more** candidates than the requested `top_k` (multiplied by `CANDIDATE_MULTIPLIER = 5`, capped at `MAX_CANDIDATES = 200`). Authorization is performed entirely by the backend after retrieval; the AI service filters by `organization_id` only.

## Directory Structure

```text
ai-service/
├── .env                          # Environment variables (Qdrant URL, key, collection)
├── requirements.txt              # Python dependencies
├── test_chunking.py              # Chunking test: extract → normalize → chunk sample.pdf
├── test_pdf_extractor.py         # PDF extraction test: prints all blocks from sample.pdf
├── test_processing.py            # End-to-end processing dry-run via DocumentProcessingService
├── test_files/
│   └── sample.pdf               # Test sample document
├── venv/                         # Python virtual environment
└── app/
    ├── main.py                   # FastAPI app, lifespan, root endpoint
    ├── core/
    │   └── exceptions.py         # ProcessingException + global exception handlers (422/500)
    ├── config/
    │   ├── config.py             # Settings for main app + health endpoint (lru_cache, .env)
    │   ├── settings.py           # Settings for Qdrant vector store (.env)
    │   ├── logger.py             # Structured logging setup
    │   ├── chunking.py           # ChunkingConfig (CHUNK_SIZE=1000, CHUNK_OVERLAP=200, MIN_CHUNK_SIZE=100)
    │   └── schemas/
    │       └── api.py            # ApiResponse schema (success, message, data)
    ├── api/
    │   ├── index.py              # /api/v1 router; includes health, processing, retrieval routes
    │   ├── health.py             # GET /api/v1/health → ApiResponse
    │   ├── processing.py         # POST /api/v1/process-document → ProcessDocumentResponse
    │   └── retrieval.py          # POST /api/v1/retrieve → RetrievalResponse
    ├── schemas/
    │   ├── document.py           # Domain models: BlockType, DocumentType, Document, DocumentPage
    │   ├── processing.py         # ProcessDocumentRequest, ProcessDocumentResponse
    │   ├── retrieval.py          # RetrievalRequest, RetrievalResult, RetrievalResponse
    │   └── api.py                # ApiResponse (success, message, data)
    └── services/
        ├── processing/           # Download, extract, normalize, chunk, embed, index pipeline
        │   ├── __init__.py       # Exports processing_service
        │   ├── service.py        # DocumentProcessingService (orchestrates full pipeline)
        │   ├── extraction.py     # ExtractionService (primary extractor → Docling fallback)
        │   ├── normalization.py  # NormalizationService (text/table/image blocks)
        │   ├── chunking.py       # ChunkingService + Chunk dataclass
        │   ├── downloader.py     # DownloaderService (httpx streaming, 60s timeout)
        │   └── temp_storage.py   # TemporaryStorage (mkdtemp + shutil.rmtree)
        ├── extractors/           # Document format extractors
        │   ├── base.py           # BaseExtractor (abstract base for format extractors)
        │   ├── table.py          # TableExtractor (camelot primary, pdfplumber fallback)
        │   ├── pdf.py            # PDFExtractor (PyMuPDF: text, images, tables)
        │   ├── docx.py           # DocxExtractor (python-docx: paragraphs, tables, images)
        │   ├── txt.py            # TXTExtractor (paragraphs with encoding support)
        │   └── docling.py        # DoclingExtractor (optional, PDF and DOCX)
        ├── embedding/            # Embedding generation
        │   ├── __init__.py       # Exports EmbeddingService, embedding_service
        │   └── service.py        # EmbeddingService + EmbeddedChunk dataclass
        ├── vectorstore/          # Qdrant vector database operations
        │   ├── __init__.py       # Exports QdrantVectorStore, qdrant_vector_store
        │   ├── qdrant.py         # QdrantVectorStore (full CRUD + search)
        │   └── test_qdrant.py    # End-to-end Qdrant verification
        └── retrieval/            # Retrieval service
            └── service.py        # RetrievalService: candidate retrieval + authorization helpers
```

## AI Service Responsibilities

Implemented pipelines:

```text
Presigned document URL
  → download to temporary workspace (DownloaderService)
  → extract PDF, DOCX, or TXT content (ExtractionService)
  → optionally merge additional Docling extraction (fallback only)
  → normalize document blocks (NormalizationService)
  → create chunks (ChunkingService)
  → generate Sentence Transformer embeddings (EmbeddingService)
  → ensure Qdrant collection and indexes exist (QdrantVectorStore)
  → upsert Qdrant points for the document version
  → remove temporary workspace (TemporaryStorage)
```

Retrieval (candidate-based, organization-filtered):

```text
User query
  → embed query text (EmbeddingService)
  → search Qdrant by vector with organization_id filter
  → return RetrievalResult[] with scores and metadata
```

The service must not make business authorization decisions. The backend is intended to determine which documents and versions a user may process or retrieve.

## FastAPI Routes

```text
GET /
GET /api/v1/health
POST /api/v1/process-document
POST /api/v1/retrieve
```

## Backend Integration

The backend helper is `backend/src/services/document/documentAI.service.js`.

It:

1. Creates a presigned S3 download URL using `getDownloadUrlFromS3(version.storageKey)`.
2. Builds `document_id`, `version_id`, `organization_id`, and `file_url`.
3. Sends the payload to `${config.ai.url}/api/v1/process-document`.

`config.ai.url` must contain only the AI service base URL, without a trailing `/api/v1` path.

The backend query flow lives in `backend/src/services/query/`:

- `queryAI.service.js` — calls `POST ${config.ai.url}/api/v1/retrieve` with `{ query, top_k, organization_id }`, returning the raw `RetrievalResponse` from the AI service.
- `query.service.js` (`retrieveAuthorizedCandidates`) — orchestrates: extract `organizationId` from `user.unit.organizationId` → check Redis cache (tenant-scoped key) → call AI service → collect candidate document IDs → `authorizeQueryDocuments(user, documentIds)` → filter to authorized documents → cache → rerank → check evidence sufficiency → build context → build RAG prompt → generate answer with LLM → output-guard.
- `query.controller.js` (`queryDocuments`) — Express handler at `POST /api/v1/query`, validates input, calls `retrieveAuthorizedCandidates`, returns `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`.

The query route is registered in `backend/src/routes/index.js` as `router.use("/query", queryRoutes)`.

## Processing Details

### Extraction

Supported input extensions are `.pdf`, `.docx`, and `.txt`. Unsupported extensions fail before extraction. Primary extraction runs first by type (PDF → `PDFExtractor`, DOCX → `DocxExtractor`, TXT → `TXTExtractor`). Docling is used as a fallback when the primary extractor finds no content blocks; a Docling failure is logged as a warning and does not fail the pipeline.

For PDFs, table extraction is delegated to `TableExtractor` which uses camelot (primary) and pdfplumber (fallback).

### Chunking

`ChunkingService` uses page-by-page, character-based chunks:

```text
chunk size:    1000 characters (configurable via ChunkingConfig)
chunk overlap:  200 characters (configurable via ChunkingConfig)
min chunk:     100 characters (MIN_CHUNK_SIZE not yet enforced)
chunk ID:      chunk_000000, chunk_000001, ...
```

Blocks larger than `chunk_size` are split into multiple chunks. Oversized block splits use a `chunk_size - chunk_overlap` step to preserve context across boundaries. Chunks contain text, page number, associated block IDs, and metadata.

The `Chunk` dataclass:

```text
chunk_id: str           # e.g. chunk_000000
page_number: int
text: str
block_ids: list[str]    # References to source document blocks
metadata: dict[str, object]  # chunk_index, page_number, block_count, character_count
```

### Embeddings

`EmbeddingService` uses Sentence Transformers with the default model `all-MiniLM-L6-v2`.

```text
batch size:       32 (configurable via constructor)
normalization:    enabled (normalize_embeddings=True)
device:           CUDA when available, CPU fallback
vector dimension: 384 for all-MiniLM-L6-v2
```

The model is instantiated during import, so startup can download/load the model and take time.

Methods:

- `embed_texts(texts)` — generates normalized embedding vectors for a list of texts; validates non-empty input and dimension match.
- `embed_chunks(chunks)` — returns `EmbeddedChunk` objects pairing each `Chunk` with its embedding.
- `embed_chunk(chunk)` — embeds a single `Chunk`; rejects empty text.

### Qdrant

`QdrantVectorStore` uses `AsyncQdrantClient` and the settings in `app/config/settings.py`.

Collection behavior:

- Creates the collection if missing (cosine distance).
- Creates payload indexes for `document_id`, `version_id`, `chunk_id`, and `organization_id` (keyword type).
- Creates deterministic UUIDv5 point IDs from document ID, version ID, and chunk ID, keeping versions separate.
- Stores `document_id`, `version_id`, `chunk_id`, `organization_id`, `page_number`, `text`, `block_ids`, and metadata in each payload.
- `search` filters by `organization_id` via Qdrant `Filter`.

Operations:

- `ensure_collection()` — creates collection and indexes if missing.
- `upsert_chunks(document_id, version_id, organization_id, embedded_chunks)` — indexes chunks with deterministic IDs.
- `get_version_points(document_id, version_id, limit)` — scrolls and retrieves all points for a specific version.
- `search(query_vector, organization_id, limit)` — organization-filtered vector search.
- `delete_version(document_id, version_id)` — deletes all points for a version.
- `delete_document(document_id)` — deletes all points for a document.
- `close()` — closes the Qdrant client.

Point IDs are UUIDv5 deterministic hashes of `document_id:version_id:chunk_id`. This ensures reprocessing the same document/version/chunk overwrites the same point while different versions are stored independently.

`DocumentProcessingService.process_document()` does not delete vectors before upserting. Each point is stored with its `document_id` and `version_id`, so processing a new version preserves prior indexed versions. Reprocessing an identical document/version/chunk combination overwrites that matching point.

### Retrieval Service

`RetrievalService` (in `app/services/retrieval/service.py`) handles candidate retrieval for the `/retrieve` route.

```text
CANDIDATE_MULTIPLIER: 5      # Fetch top_k * 5 candidates
MAX_CANDIDATES:      200     # Hard cap on candidate count
```

Methods:

- `retrieve_candidates(request)` — embeds the query, searches Qdrant with `candidate_limit = min(top_k * 5, 200)` filtered by `organization_id`, returns `RetrievalResult[]`. Backend-side authorization is NOT performed here.
- `get_candidate_document_ids(candidates)` — extracts unique document IDs from results (for backend authorization).
- `filter_authorized_candidates(candidates, authorized_document_ids)` — filters candidates to only those from authorized documents.
- `select_top_k(candidates, top_k)` — returns the top-K candidates after authorization.

The service retrieves more candidates than `top_k` because backend authorization narrows the set. The AI service returns all candidates with their `document_id`; the backend then calls `authorizeQueryDocuments` to determine which documents the user can access, filters, and selects the final top-K.

## Configuration

Create `ai-service/.env`:

```dotenv
APP_NAME="Enterprise RAG AI Service"
APP_VERSION="1.0.0"
ENVIRONMENT="development"
HOST="0.0.0.0"
PORT=8000
LOG_LEVEL="INFO"

EMBEDDING_MODEL="all-MiniLM-L6-v2"
QDRANT_URL="https://your-cluster.qdrant.io"
QDRANT_API_KEY="your-qdrant-api-key"
QDRANT_COLLECTION="enterprise_documents"
```

Two settings modules exist:

- `app/config/config.py` — used by `main.py` and the health route. Loads from `.env`, case-sensitive, ignores extra keys.
- `app/config/settings.py` — used by Qdrant. Loads from `.env` with UTF-8 encoding, ignores extra keys. Includes `QDRANT_COLLECTION`.

Keep common values aligned. Consolidating these modules is a useful cleanup task.

**Error handling**: `app/core/exceptions.py` provides `ProcessingException` and registers two global FastAPI exception handlers:

- `RequestValidationError` → HTTP 422 with `{ success: false, message: "Validation Error", errors: [...] }`
- Generic `Exception` → HTTP 500 with `{ success: false, message: "Internal Server Error" }`

All exceptions in the processing pipeline are re-raised after logging, so the global handler formats the response.

## Local Development

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Main dependencies include FastAPI, httpx, PyMuPDF, python-docx, Sentence Transformers, PyTorch, and qdrant-client.

## Testing

Three test scripts are provided:

| Script | Purpose |
|--------|---------|
| `test_pdf_extractor.py` | Extracts sample.pdf and prints all blocks (type, text, headers, rows, metadata) |
| `test_chunking.py` | Full pipeline: extract → normalize → chunk, prints chunk details |
| `test_processing.py` | End-to-end processing dry-run via `DocumentProcessingService` |
| `app/services/vectorstore/test_qdrant.py` | Qdrant end-to-end: ensure → embed → upsert → read back → search → verify deterministic ID → delete → verify deletion |

## Recent Updates (2026-09-20)

1. **Multi-tenant organization isolation** — Added `organization_id` to processing and retrieval flows. `ProcessDocumentRequest` and `RetrievalRequest` require `organization_id`. `QdrantVectorStore` indexes `organization_id`, stores it in payloads, and filters by it in search. `RetrievalService` and `DocumentProcessingService` pass `organization_id` through.

2. **Fixed import errors** — `BaseExtractor` now defined locally in `app/services/extractors/base.py` (removed circular self-import). `ApiResponse` model added to `app/schemas/api.py`. Legacy `app/schemas/retrieval/` package deleted (conflict with `app/schemas/retrieval.py` module resolved).

3. **Backend integration updated** — `documentAI.service.js` sends `organization_id` in processing payload. `queryAI.service.js`, `queryCache.service.js`, and `query.service.js` forward `organization_id` through the query pipeline.

## Current Gaps and Recommended Next Work

1. Add an end-to-end test using a local or test Qdrant collection and a real sample document.
2. Define same-version reprocessing semantics. Reprocessing does not delete vectors; chunks no longer produced by a reprocessed version remain indexed unless an explicit cleanup workflow is introduced.
3. Add processing status reporting, retries, structured error responses, and metrics.
4. Add `__init__.py` to `app/services/retrieval/` — currently missing, unlike `embedding/`, `vectorstore/`, and `processing/`.
5. Test multi-tenant isolation — verify `organization_id` filtering in Qdrant search and backend organization context passing.
6. Add organization_id to document access checks — backend's `authorizeQueryDocuments` should verify user belongs to the organization before allowing retrieval.
7. Resolve duplicate entries in `requirements.txt` (httpx, PyMuPDF, python-docx appear twice).
8. Enforce `MIN_CHUNK_SIZE` from `ChunkingConfig` in the chunking logic.
9. Add hybrid search and reranking after filtered retrieval works.
10. Add grounded LLM generation, citations, and evaluation only after authorization-safe retrieval is complete.

## Constraints for Future Changes

- Do not expose Qdrant search directly to end users.
- Do not treat Qdrant payload metadata as the source of truth for authorization.
- Do not pass retrieved text to an LLM until backend-authorized document/version filtering is applied.
- Preserve the separation between extraction, chunking, embedding, and vector-store services.
- Docling failure must remain a warning, not an error, in the extraction pipeline.
