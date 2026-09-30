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
│   └── sample.pdf                # Test sample document
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
    │   ├── processing.py         # ProcessDocumentRequest (incl. file_name), ProcessDocumentResponse
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
        ├── vectorstore/           # Qdrant vector database operations
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

Supported input extensions are `.pdf`, `.docx`, and `.txt`. The suffix is read from the required `file_name` field, not from the presigned URL. Unsupported extensions fail before extraction. Primary extraction runs first by type (PDF → `PDFExtractor`, DOCX → `DocxExtractor`, TXT → `TXTExtractor`). Docling is used as a fallback when the primary extractor finds no content blocks; a Docling failure is logged as a warning and does not fail the pipeline.

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

The `Chunk` dataclass:

```text
chunk_id: str                 # e.g. chunk_000000
page_number: int
text: str
block_ids: list[str]          # References to source document blocks
metadata: dict[str, object]   # chunk_index, page_number, block_count, character_count
```

### Embeddings

`EmbeddingService` uses Sentence Transformers with the default model `all-MiniLM-L6-v2`.

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

| Script | Purpose |
|--------|---------|
| `test_pdf_extractor.py` | Extracts sample.pdf and prints all blocks (type, text, headers, rows, metadata) |
| `test_chunking.py` | Full pipeline: extract → normalize → chunk, prints chunk details |
| `test_processing.py` | End-to-end processing dry-run via `DocumentProcessingService` |
| `app/services/vectorstore/test_qdrant.py` | Qdrant end-to-end: ensure → embed → upsert → read back → search → verify deterministic ID → delete → verify deletion |

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
- Block normalization and page-by-page character-based chunking.
- Sentence Transformer embeddings using `all-MiniLM-L6-v2` (384 dimensions).
- Qdrant collection/index management, organization filtering, version-aware deterministic point IDs, and vector upsert/search.
- Candidate retrieval with `top_k * 5`, capped at 200.
- Backend integration for processing and authorization-safe retrieval.
- Multi-tenant `organization_id` propagation through processing, retrieval, Qdrant payloads, and search filtering.

# Known Defects

Found by a full read-through audit on 2026-09-30. Every item was verified by reading the code.

## Blocking

### The service cannot start from `requirements.txt`

`camelot` and `pdfplumber` are imported unconditionally at module scope in `app/services/extractors/base.py:9-10` and `app/services/extractors/table.py:6-7`, and `docling` in `app/services/extractors/docling.py:6`. None of the three appear in `requirements.txt`, which is the only dependency manifest in the repository.

`pip install -r requirements.txt` followed by `uvicorn app.main:app` fails with `ModuleNotFoundError` at import time, for every route. Docling in particular is documented as an optional fallback that must never fail the pipeline, yet its absence prevents the service from starting at all.

### No authentication on any route

Neither `/process-document` nor `/retrieve` has any authentication, authorisation dependency, or API-key check. `organization_id` is taken verbatim from the request body and passed straight into the Qdrant `Filter` (`app/api/retrieval.py:17-22`).

Anyone who can reach the port can read any tenant's full document text by supplying that tenant's `organization_id`, and can drive the processing pipeline. The entire authorisation model documented above — the backend filters the candidate set — depends on the AI service being unable to serve a caller the backend did not vouch for. That assumption is currently unenforced.

### Server-side request forgery via `file_url`

`file_url` is an arbitrary caller-supplied URL that the service fetches server-side with `httpx` and `follow_redirects=True` (`app/services/processing/downloader.py:11-19`). Only the URL scheme is validated, by Pydantic's `HttpUrl`.

An unauthenticated caller can make the service request cloud metadata endpoints (`169.254.169.254`), internal services, or an attacker-controlled host, and the response is written to disk and parsed.

### Tables and images are never indexed

`ChunkingService._is_text_block` (`app/services/processing/chunking.py:222-234`) returns `True` only for `TextBlock` instances and for `TEXT`, `HEADING`, `LIST`, and `CODE` block types. `TABLE`, `IMAGE`, and `FIGURE` blocks are skipped at `chunking.py:69-70` and are never converted to text anywhere in the pipeline.

The documented contract — "normalize blocks (text, table, image)" — therefore produces a text-only index. A document cannot be retrieved by the data in its tables or by text inside its images, and no warning is emitted. `DoclingExtractor` additionally converts Docling table items to `TableBlock` with empty `headers` and `rows` (`docling.py:88-96`), so the fallback path discards table content even before chunking.

### Exception handlers are never registered

`register_exception_handlers(app)` is defined in `app/core/exceptions.py:18-51` and is not called anywhere; `main.py` only calls `app.include_router(api_router)`. The only occurrence of the symbol in the repository is its own definition.

The documented error contract — 422 for `RequestValidationError`, structured JSON 500 for everything else — does not exist. A `ProcessingException` surfaces as a bare uvicorn text response, and the backend's axios error handling never sees the `{ success, message }` shape it expects.

## Index Integrity

### Stale vectors survive same-version reprocessing

Point IDs are `uuid5(document_id:version_id:chunk_id)` with positional chunk ids (`chunk_000000`, `chunk_000001`, …), and `process_document` upserts without deleting the previous set for that version.

If a reprocess produces fewer chunks than the previous run — or different extraction output, such as the Docling fallback firing on the second pass — the old higher-numbered points remain live under the same `version_id`. The backend's current-version cache validation cannot detect this, because the version id is unchanged, so obsolete chunks are returned and cited as if current.

`delete_version` exists in `QdrantVectorStore` but no caller invokes it before upserting.

### `/retrieve` does not ensure the collection exists

`ensure_collection()` runs only on the processing path (`app/services/processing/service.py:98`). A query that arrives before any document has been indexed calls `query_points` against a non-existent collection and fails with an opaque Qdrant 404 instead of returning an empty result.

### `get_version_points` silently truncates

`QdrantVectorStore.get_version_points` calls `client.scroll` with a single `limit` (default 100) and discards `next_page_offset` (`qdrant.py:187-233`). Any version with more than 100 chunks returns a partial list, and the dropped offset makes the truncation invisible — the documentation claims it retrieves all points for a version.

## Performance

- **The event loop is blocked during processing.** `extraction_service.extract`, `chunking_service.chunk`, `embedding_service.embed_chunks`, and `embed_texts` are all synchronous and CPU-heavy, called directly inside `async def` with no `run_in_threadpool` or `asyncio.to_thread` anywhere in the package. While one document is being parsed or embedded, `/health` and every `/retrieve` call are unresponsive.
- **Unbounded memory per document.** All chunks are embedded into one in-memory list and materialised as a single `points` list for one `upsert` (`qdrant.py:143-177`, `service.py:85`). A large PDF holds tens of thousands of 384-float vectors at once, and nothing caps the chunk count anywhere in the pipeline.
- **The PDF is re-parsed once per page.** `PDFExtractor._extract_tables` is called per page and each call runs `camelot.read_pdf`, re-opening and re-parsing the whole file. Cost is quadratic in page count and dominates `/process-document` on long reports.
- **`ensure_collection` runs per upload.** `collection_exists` + `get_collection` + up to four `create_payload_index` calls happen for every processed document (`service.py:98` → `qdrant.py:45-118`), with no caching of the index-existence result.
- **Overlap across oversized blocks is discarded.** `chunking.py:119` computes the overlap from the preceding block, then `chunking.py:148` unconditionally overwrites `current_text` with the new block's text. The documented context preservation across an oversized-block boundary does not occur.

## Test Scripts Are Non-Functional

- `app/services/vectorstore/test_qdrant.py:85-89, 163-166` calls `upsert_chunks` and `search` without the now-required `organization_id` argument, so it raises `TypeError` on the first upsert and can never pass.
- `test_processing.py:9-13` builds `ProcessDocumentRequest` without the required `organization_id` or `file_name`, so it fails Pydantic validation before doing any work.
- `test_chunking.py` and `test_pdf_extractor.py` run their pipelines at module import time with no `if __name__ == "__main__":` guard, so any pytest collection executes real extraction on `test_files/sample.pdf`.

## Configuration

- **`EMBEDDING_MODEL` is ignored.** `EmbeddingService` is instantiated with no argument and uses the hardcoded default `"all-MiniLM-L6-v2"` (`app/services/embedding/service.py:35`). The `EMBEDDING_MODEL` setting in `.env` is read by no consumer, so changing it has no effect — while `QdrantVectorStore.vector_size` is derived from whatever model actually loads, which makes a dimension mismatch silent.
- **The two settings modules disagree.** `config.py` sets `case_sensitive=True`; `settings.py` does not. Only `settings.py` defines `QDRANT_COLLECTION`. `config.py` makes `ENVIRONMENT`, `EMBEDDING_MODEL`, and `QDRANT_URL` required with no defaults, while `settings.py` defaults them. Both use a CWD-relative `env_file=".env"`, so running uvicorn from the repo root instead of `ai-service/` silently loads no configuration and fails at boot.
- **Whitespace-only queries return 500.** `RetrievalRequest.query` validates `min_length=1`, so `"   "` passes the schema and then raises `ValueError` inside `embed_texts`. The empty-text guard belongs in the schema.
- **Unsupported file types are rejected only after a full download.** `process_document` rejects an empty suffix but not an unsupported one, so an arbitrarily large file with an unsupported extension is downloaded in full before `ExtractionService` raises.
- **The Qdrant client is never closed.** The lifespan yields without calling `qdrant_vector_store.close()`, so connections accumulate across `uvicorn --reload` cycles.

## Dead Code

- `app/services/extractors/base.py:81-238` contains a second, unreachable copy of `TableExtractor`; `pdf.py` imports the live one from `table.py`. The two already differ in string handling. It is also what forces the `camelot`/`pdfplumber` imports into `base.py`.
- `RetrievalService.get_candidate_document_ids`, `filter_authorized_candidates`, and `select_top_k` are never called by any endpoint. `filter_authorized_candidates` in particular is an authorisation helper that, by the project's own rules, should not live in this service.
- `app/services/extractors/init.py` is misnamed — it is not `__init__.py`, so it never executes as a package init, and it references a class `DOCXExtractor` that does not exist (`docx.py` defines `DocxExtractor`).
- `app/config/schemas/api.py` duplicates `app/schemas/api.py` and is imported by nobody. `app/schemas/chunk.py::DocumentChunk` is imported by nobody.
- `configure_logging` is never called.

---

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
