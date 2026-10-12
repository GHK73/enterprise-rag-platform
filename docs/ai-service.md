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
  → POST /api/v1/process-document { document_id, version_id, organization_id, file_url, file_name }

    → AI Service (FastAPI)
      → Validate URL (SSRF protection: block private IPs, metadata endpoints, non-HTTP schemes)
      → Download file from presigned URL (httpx, 60s timeout)
      → Reject unsupported extensions before download (.pdf, .docx, .txt only)
      → Extract content (primary extractor → Docling fallback)
      → Normalize blocks (text, table, image)
      → Chunk content (page-by-page, character-based; tables and images are indexed as text)
      → Generate embeddings (Sentence Transformer, reads EMBEDDING_MODEL from .env via settings.py)
      → Delete previous version vectors (avoid stale points)
      → Ensure Qdrant collection exists
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
        → Ensure Qdrant collection exists
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
│   └── sample.pdf                # Test sample document
├── venv/                         # Python virtual environment
└── app/
    ├── main.py                   # FastAPI app, lifespan, root endpoint, exception handlers, Qdrant shutdown
    ├── core/
    │   └── exceptions.py         # ProcessingException + global exception handlers (422/500)
    ├── config/
    │   ├── config.py             # Settings for main app + health endpoint (lru_cache, .env)
    │   ├── settings.py           # Settings for Qdrant vector store (.env)
    │   ├── logger.py             # Structured logging setup (used by main.py)
    │   └── chunking.py           # ChunkingConfig (CHUNK_SIZE=1000, CHUNK_OVERLAP=200, MIN_CHUNK_SIZE=100)
    ├── utils/
    │   └── logger.py             # configure_logging() — currently unused
    ├── api/
    │   ├── index.py              # /api/v1 router; includes health, processing, retrieval routes
    │   ├── health.py             # GET /api/v1/health → ApiResponse
    │   ├── processing.py         # POST /api/v1/process-document → ProcessDocumentResponse
    │   └── retrieval.py          # POST /api/v1/retrieve → RetrievalResponse
    ├── schemas/
    │   ├── document.py           # Domain models: BlockType, DocumentType, Document, DocumentPage
    │   ├── processing.py         # ProcessDocumentRequest (incl. file_name), ProcessDocumentResponse
    │   ├── retrieval.py          # RetrievalRequest (whitespace validator), RetrievalResult, RetrievalResponse
    │   ├── api.py                # ApiResponse (success, message, data)
    │   └── chunk.py              # DocumentChunk — dead code, not used anywhere
    └── services/
        ├── processing/           # Download, extract, normalize, chunk, embed, index pipeline
        │   ├── __init__.py       # Exports processing_service
        │   ├── service.py        # DocumentProcessingService (orchestrates full pipeline)
        │   ├── extraction.py     # ExtractionService (primary extractor → Docling fallback)
        │   ├── normalization.py  # NormalizationService (text/table/image blocks)
        │   ├── chunking.py       # ChunkingService + Chunk dataclass
        │   ├── downloader.py     # DownloaderService (httpx streaming, 60s timeout, SSRF protection)
        │   └── temp_storage.py   # TemporaryStorage (mkdtemp + shutil.rmtree)
        ├── extractors/           # Document format extractors
        │   ├── base.py           # BaseExtractor (abstract base for format extractors)
        │   ├── table.py          # TableExtractor (camelot primary, pdfplumber fallback; does NOT extend BaseExtractor)
        │   ├── pdf.py            # PDFExtractor (PyMuPDF: text, images, tables)
        │   ├── docx.py           # DocxExtractor (python-docx: paragraphs, tables, images)
        │   ├── txt.py            # TXTExtractor (paragraphs with encoding support)
        │   └── docling.py        # DoclingExtractor (optional, PDF and DOCX)
        ├── embedding/            # Embedding generation
        │   ├── __init__.py       # Exports EmbeddingService, embedding_service
        │   └── service.py        # EmbeddingService + EmbeddedChunk dataclass
        ├── vectorstore/           # Qdrant vector database operations
        │   ├── __init__.py       # Exports QdrantVectorStore, qdrant_vector_store
        │   ├── qdrant.py         # QdrantVectorStore (full CRUD + search, paginated scroll)
        │   └── test_qdrant.py    # End-to-end Qdrant verification
        ├── retrieval/            # Retrieval service
        │   ├── __init__.py       # Exports retrieval_service
        │   └── service.py        # RetrievalService: candidate retrieval + ensure_collection
        └── extractors/__init__.py # MISSING — should exist but does not
```

## AI Service Responsibilities

Implemented pipelines:

```text
Presigned document URL
  → validate URL for SSRF (DownloaderService)
  → reject unsupported extensions before download (DocumentProcessingService)
  → download to temporary workspace (DownloaderService)
  → extract PDF, DOCX, or TXT content (ExtractionService)
  → optionally merge additional Docling extraction (fallback only)
  → normalize document blocks (NormalizationService)
  → create chunks (ChunkingService; tables and images are indexed as text)
  → generate Sentence Transformer embeddings (EmbeddingService; reads EMBEDDING_MODEL from .env via settings.py)
  → delete previous version vectors to avoid stale data (QdrantVectorStore.delete_version)
  → ensure Qdrant collection exists (QdrantVectorStore.ensure_collection)
  → upsert Qdrant points for the document version
  → remove temporary workspace (TemporaryStorage)
```

Retrieval (candidate-based, organization-filtered):

```text
User query
  → ensure Qdrant collection exists (QdrantVectorStore.ensure_collection)
  → embed query text (EmbeddingService)
  → search Qdrant by vector with organization_id filter
  → return RetrievalResult[] with scores and metadata
```

Authorization boundary: the AI service only applies organization-level Qdrant filtering; document/version access decisions remain in the backend.

## FastAPI Routes

```text
GET  /
GET  /api/v1/health
POST /api/v1/process-document
POST /api/v1/retrieve
```

## Backend Integration

The backend helper is `backend/src/services/document/documentAI.service.js`.

It:

1. Creates a presigned S3 download URL using `getDownloadUrlFromS3(version.storageKey)`.
2. Builds `document_id`, `version_id`, `organization_id`, `file_url`, and `file_name` (`version.originalFileName`).
3. Sends the payload to `${config.ai.url}/api/v1/process-document`.

`file_name` is required. The file extension is taken from the original filename rather than the presigned URL path, because the S3 key does not reliably end in a recognisable extension.

`config.ai.url` must contain only the AI service base URL, without a trailing `/api/v1` path.

The backend query flow lives in `backend/src/services/query/`:

- `queryAI.service.js` — calls `POST ${config.ai.url}/api/v1/retrieve` with `{ query, top_k, organization_id }`, returning the raw `RetrievalResponse` from the AI service.
- `query.service.js` (`retrieveAuthorizedCandidates`) — orchestrates: extract `organizationId` from `user.unit.organizationId` → check Redis cache (tenant-scoped key) → call AI service → collect candidate document IDs → `authorizeQueryDocuments(user, documentIds)` → filter to authorized documents → cache → rerank → check evidence sufficiency → build context → build RAG prompt → generate answer with LLM → output-guard.
- `query.controller.js` (`queryDocuments`) — Express handler at `POST /api/v1/query`, validates input, calls `retrieveAuthorizedCandidates`, returns `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`.

The query route is registered in `backend/src/routes/index.js` as `router.use("/query", queryRoutes)`.

## Processing Details

### Extraction

Supported input extensions are `.pdf`, `.docx`, and `.txt`. The suffix is read from the required `file_name` field, not from the presigned URL. Unsupported extensions fail before download. Primary extraction runs first by type (PDF → `PDFExtractor`, DOCX → `DocxExtractor`, TXT → `TXTExtractor`). Docling is used as a fallback when the primary extractor finds no content blocks; a Docling failure is logged as a warning and does not fail the pipeline.

`BaseExtractor` provides `log_start`, `log_success`, and `log_failure` helpers so every extractor logs the file it processed, the elapsed time, and the failure reason in a consistent format.

For PDFs, table extraction is delegated to `TableExtractor` which uses camelot (primary) and pdfplumber (fallback).

### Chunking

`ChunkingService` uses page-by-page, character-based chunks:

```text
chunk size:   1000 characters (configurable via ChunkingConfig)
chunk overlap: 200 characters (configurable via ChunkingConfig)
min chunk:    100 characters (MIN_CHUNK_SIZE not yet enforced)
chunk ID:     chunk_000000, chunk_000001, ...
```

Blocks larger than `chunk_size` are split into multiple chunks. Oversized block splits use a `chunk_size - chunk_overlap` step to preserve context across boundaries. Chunks contain text, page number, associated block IDs, and metadata.

Table, image, and figure blocks are converted to searchable text:
- Tables are rendered as markdown-style text (headers, separator row, data rows).
- Images and figures use `caption` or `ocr_text` when available.

The `Chunk` dataclass:

```text
chunk_id: str                 # e.g. chunk_000000
page_number: int
text: str
block_ids: list[str]          # References to source document blocks
metadata: dict[str, object]   # chunk_index, page_number, block_count, character_count
```

### Embeddings

`EmbeddingService` uses Sentence Transformers. The model name is read from the `EMBEDDING_MODEL` environment variable via `app/config/settings.py` (default `all-MiniLM-L6-v2`).

```text
batch size:      32 (configurable via constructor)
normalization:   enabled (normalize_embeddings=True)
device:          CUDA when available, CPU fallback
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
- `get_version_points(document_id, version_id, limit)` — paginates through all points for a specific version (no silent truncation).
- `search(query_vector, organization_id, limit)` — organization-filtered vector search.
- `delete_version(document_id, version_id)` — deletes all points for a version.
- `delete_document(document_id)` — deletes all points for a document.
- `close()` — closes the Qdrant client.

Point IDs are UUIDv5 deterministic hashes of `document_id:version_id:chunk_id`. This ensures reprocessing the same document/version/chunk overwrites the same point while different versions are stored independently.

`DocumentProcessingService.process_document()` now calls `delete_version()` before `upsert_chunks()` so same-version reprocessing does not leave stale vectors.

### Retrieval Service

`RetrievalService` (in `app/services/retrieval/service.py`) handles candidate retrieval for the `/retrieve` route.

```text
CANDIDATE_MULTIPLIER: 5      # Fetch top_k * 5 candidates
MAX_CANDIDATES:      200     # Hard cap on candidate count
```

Methods:

- `retrieve_candidates(request)` — ensures collection exists, embeds the query, searches Qdrant with `candidate_limit = min(top_k * 5, 200)` filtered by `organization_id`, returns `RetrievalResult[]`. Backend-side authorization is NOT performed here.
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

Two settings modules exist, now aligned:

- `app/config/config.py` — used by `main.py` and the health route. Loads from `.env` with UTF-8 encoding, ignores extra keys. Provides safe defaults so running uvicorn from the repo root does not silently fail.
- `app/config/settings.py` — used by Qdrant. Loads from `.env` with UTF-8 encoding, ignores extra keys. Includes `QDRANT_COLLECTION`.

Both modules now share the same defaults and encoding. Consolidating them remains a useful cleanup task.

**Error handling**: `app/core/exceptions.py` provides `ProcessingException` and registers two global FastAPI exception handlers. The handlers are now invoked in `app/main.py`:

- `RequestValidationError` → HTTP 422 with `{ success: false, message: "Validation Error", errors: [...] }`
- Generic `Exception` → HTTP 500 with `{ success: false, message: "Internal Server Error" }`

All exceptions in the processing pipeline are re-raised after logging, so the global handler formats the response.

**Logging**: `app/config/logger.py` provides `configure_logger()` and is called during startup in `main.py`. `app/utils/logger.py` also exists but is currently unused.

## Local Development

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Main dependencies include FastAPI, httpx, PyMuPDF, python-docx, camelot-py, pdfplumber, docling, Sentence Transformers, PyTorch, and qdrant-client.

## Testing

| Script | Purpose |
|--------|---------|
| `test_pdf_extractor.py` | Extracts sample.pdf and prints all blocks (type, text, headers, rows, metadata) |
| `test_chunking.py` | Full pipeline: extract → normalize → chunk, prints chunk details |
| `test_processing.py` | End-to-end processing dry-run via `DocumentProcessingService` |
| `app/services/vectorstore/test_qdrant.py` | Qdrant end-to-end: ensure → embed → upsert → read back → search → verify deterministic ID → delete → verify deletion |

All test scripts now run under `if __name__ == "__main__":` guards and include required fields.

## Recent Updates (2026-10-06)

1. **Fixed stale vectors on same-version reprocessing** — `DocumentProcessingService.process_document()` now calls `delete_version()` before `upsert_chunks()`, so reprocessing a version does not leave obsolete chunks behind.
2. **Fixed tables and images never being indexed** — `ChunkingService._block_to_text()` now converts `TABLE`, `IMAGE`, and `FIGURE` blocks to searchable text (markdown-style tables, captions, OCR text).
3. **Fixed SSRF in downloader** — `DownloaderService` now validates URLs before fetching, blocking private/loopback IPs, cloud metadata endpoints, and non-HTTP schemes.
4. **Fixed missing exception handlers** — `register_exception_handlers(app)` is now called in `main.py`; the documented 422/500 JSON contract is active.
5. **Fixed `/retrieve` before first upload** — `RetrievalService.retrieve_candidates()` now calls `ensure_collection()` before searching, preventing opaque Qdrant 404s.
6. **Fixed `get_version_points` silent truncation** — now paginates through Qdrant scroll results using `next_page_offset`.
7. **Fixed `EMBEDDING_MODEL` being ignored** — `EmbeddingService` now reads `EMBEDDING_MODEL` from `.env` via `app/config/settings.py`.
8. **Fixed whitespace-only queries** — `RetrievalRequest` now validates that `query` is not whitespace-only, returning HTTP 422 instead of 500.
9. **Fixed unsupported file downloads** — `DocumentProcessingService` now rejects unsupported extensions before downloading the file.
10. **Fixed Qdrant client not closing** — lifespan shutdown now calls `qdrant_vector_store.close()`.
11. **Aligned settings modules** — `app/config/config.py` now matches `app/config/settings.py` defaults and UTF-8 encoding.
12. **Fixed `requirements.txt`** — added missing `camelot-py`, `pdfplumber`, `docling`; removed duplicate entries.
13. **Removed dead code** — deleted unreachable `TableExtractor` from `extractors/base.py`, deleted misnamed `extractors/init.py`, deleted duplicate `config/schemas/api.py`.
14. **Added missing package init** — `app/services/retrieval/__init__.py` now exists.
15. **Fixed test scripts** — `test_qdrant.py`, `test_processing.py`, `test_chunking.py`, and `test_pdf_extractor.py` now include required fields and `__main__` guards.

## Recent Updates (2026-09-30)

1. **`file_name` in the processing contract** — `ProcessDocumentRequest` now requires `file_name`. `DocumentProcessingService.process_document()` derives the file suffix from `Path(request.file_name).suffix` instead of parsing `request.file_url`. Previously a presigned URL whose path did not end in a supported extension raised "Document URL must contain a file extension." even for valid uploads.
2. **Extraction logging** — `BaseExtractor` gained `log_start`, `log_success`, and `log_failure` helpers built on `time.perf_counter()`, giving consistent per-file extraction timing and failure logging across every extractor.

## Recent Updates (2026-09-20)

1. **Multi-tenant organization isolation** — Added `organization_id` to processing and retrieval flows. `ProcessDocumentRequest` and `RetrievalRequest` require `organization_id`. `QdrantVectorStore` indexes `organization_id`, stores it in payloads, and filters by it in search. `RetrievalService` and `DocumentProcessingService` pass `organization_id` through.
2. **Fixed import errors** — `BaseExtractor` now defined locally in `app/services/extractors/base.py` (removed circular self-import). `ApiResponse` model added to `app/schemas/api.py`. Legacy `app/schemas/retrieval/` package deleted (conflict with `app/schemas/retrieval.py` module resolved).
3. **Backend integration updated** — `documentAI.service.js` sends `organization_id` in processing payload. `queryAI.service.js`, `queryCache.service.js`, and `query.service.js` forward `organization_id` through the query pipeline.

## Current Status

Implemented:

- FastAPI processing and retrieval routes.
- PDF, DOCX, and TXT extraction with Docling fallback.
- Block normalization and page-by-page character-based chunking (tables and images indexed as text).
- Sentence Transformer embeddings using `all-MiniLM-L6-v2` (384 dimensions), configurable via `EMBEDDING_MODEL`.
- Qdrant collection/index management, organization filtering, version-aware deterministic point IDs, vector upsert/search, and paginated scroll.
- Candidate retrieval with `top_k * 5`, capped at 200, with collection auto-creation.
- Backend integration for processing and authorization-safe retrieval.
- Multi-tenant `organization_id` propagation through processing, retrieval, Qdrant payloads, and search filtering.
- Structured error responses (422 validation, 500 internal) via registered global exception handlers.
- SSRF protection on `file_url` downloads.
- Graceful shutdown closing Qdrant client connections.

## Remaining Gaps and Recommended Next Work

1. Add an end-to-end test using a local or test Qdrant collection and a real sample document.
2. Add processing status reporting, retries, structured error responses, and metrics.
3. Test multi-tenant isolation — verify `organization_id` filtering in Qdrant search and backend organization context passing.
4. Add `organization_id` to document access checks — backend's `authorizeQueryDocuments` should verify user belongs to the organization before allowing retrieval.
5. Enforce `MIN_CHUNK_SIZE` from `ChunkingConfig` in the chunking logic.
6. Add hybrid search and reranking after filtered retrieval works.
7. Add grounded LLM generation, citations, and evaluation only after authorization-safe retrieval is complete.
8. Consolidate `app/config/config.py` and `app/config/settings.py` into a single settings module.

## Constraints for Future Changes

- Do not expose Qdrant search directly to end users.
- Do not treat Qdrant payload metadata as the source of truth for authorization.
- Do not pass retrieved text to an LLM until backend-authorized document/version filtering is applied.
- Preserve the separation between extraction, chunking, embedding, and vector-store services.
- Docling failure must remain a warning, not an error, in the extraction pipeline.
