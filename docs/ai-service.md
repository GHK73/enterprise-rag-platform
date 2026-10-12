# AI Service Handoff

Copy this document into a new AI chat when working on the AI service.

The AI service lives in `ai-service/`. It converts documents into Qdrant vectors and provides candidate retrieval. It does **not** perform authorization or RAG generation — the backend applies document-access policies after retrieval and before any LLM use.

```text
frontend/    React + Vite user interface
backend/     Node.js + Express API, Prisma, S3, Redis/BullMQ
ai-service/  FastAPI document-processing and vector-indexing service
```

## Architecture

**Processing flow**

```text
Backend → POST /api/v1/process-document
            { document_id, version_id, organization_id, file_url, file_name }
  → validate URL (SSRF protection: block private IPs, metadata endpoints, non-HTTP schemes)
  → reject unsupported extensions before download (.pdf, .docx, .txt only)
  → download from presigned URL (httpx, 60s timeout)
  → extract (primary extractor → Docling fallback)
  → normalize blocks (text, table, image)
  → chunk (page-by-page, character-based; tables/images indexed as text)
  → embed (Sentence Transformer, EMBEDDING_MODEL from .env)
  → delete previous version vectors (avoid stale points)
  → ensure Qdrant collection exists
  → upsert (version-aware deterministic point IDs)
  → cleanup temporary workspace
← ProcessDocumentResponse { success, message, document_id, version_id }
```

**Retrieval flow**

```text
Backend POST /api/v1/query
  → AI service POST /api/v1/retrieve { query, organization_id, top_k }
      → ensure collection → embed query
      → search Qdrant (candidate_limit = min(top_k * 5, 200))
  ← RetrievalResponse { query, results[] }
  → backend authorizes document_ids via policy checks
  → backend filters candidates to authorized documents
  → backend reranks and generates answer with LLM
```

The AI service intentionally retrieves **more** candidates than `top_k` (`CANDIDATE_MULTIPLIER = 5`, capped at `MAX_CANDIDATES = 200`) because backend authorization narrows the set. The AI service filters by `organization_id` only.

## Routes

```text
GET  /
GET  /api/v1/health
POST /api/v1/process-document
POST /api/v1/retrieve
```

## Processing Details

**Extraction** — `.pdf`, `.docx`, `.txt` only; the suffix comes from the required `file_name` field (the S3 key does not reliably end in a recognizable extension). Primary extractor by type (PDF/DOCX/TXT); Docling is a fallback whose failure is a warning, not an error. PDF tables use camelot (primary) and pdfplumber (fallback).

**Chunking** — page-by-page, character-based:

```text
chunk size:    1000 characters   (ChunkingConfig)
chunk overlap: 200 characters   (ChunkingConfig)
min chunk:     100 characters   (MIN_CHUNK_SIZE not yet enforced)
chunk ID:      chunk_000000, chunk_000001, ...
```

Tables render as markdown-style text; images/figures use `caption` or `ocr_text`.

**Embeddings** — Sentence Transformers, `EMBEDDING_MODEL` (default `all-MiniLM-L6-v2`, 384 dimensions), batch size 32, normalized, CUDA when available. The model loads at import, so startup can take time.

**Qdrant** — `AsyncQdrantClient`. Creates the collection if missing (cosine distance) with payload indexes on `document_id`, `version_id`, `chunk_id`, `organization_id`. Point IDs are deterministic UUIDv5 hashes of `document_id:version_id:chunk_id`, so reprocessing overwrites the same points while versions stay separate. `process_document()` calls `delete_version()` before `upsert_chunks()` so same-version reprocessing leaves no stale vectors.

**Retrieval service** — `retrieve_candidates(request)` ensures the collection, embeds the query, searches with `candidate_limit = min(top_k * 5, 200)` filtered by `organization_id`. Backend-side authorization is **not** performed here.

## Backend Integration

`backend/src/services/document/documentAI.service.js` creates a presigned S3 URL and sends `{ document_id, version_id, organization_id, file_url, file_name }` to `${config.ai.url}/api/v1/process-document`. `config.ai.url` must contain only the base URL, without a trailing `/api/v1`.

The query flow lives in `backend/src/services/query/`: `queryAI.service.js` calls `/retrieve`; `query.service.js` orchestrates cache → retrieve → authorize → filter → rerank → evidence check → prompt → LLM → guardrail; `query.controller.js` returns `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`.

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

Two settings modules exist, now aligned: `app/config/config.py` (main app + health) and `app/config/settings.py` (Qdrant vector store). Consolidating them remains a cleanup task. Error handling: `ProcessingException` plus global handlers (422 validation, 500 internal). Logging: `configure_logger()` called at startup.

## Local Development

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Main dependencies: FastAPI, httpx, PyMuPDF, python-docx, camelot-py, pdfplumber, docling, Sentence Transformers, PyTorch, qdrant-client.

## Testing

| Script | Purpose |
| --- | --- |
| `test_pdf_extractor.py` | Extracts sample.pdf and prints all blocks |
| `test_chunking.py` | Full pipeline: extract → normalize → chunk |
| `test_processing.py` | End-to-end processing dry-run |
| `app/services/vectorstore/test_qdrant.py` | Qdrant: ensure → embed → upsert → read back → search → verify ID → delete → verify |

## Current Status

Implemented: FastAPI processing and retrieval routes; PDF/DOCX/TXT extraction with Docling fallback; block normalization and chunking (tables and images indexed as text); Sentence Transformer embeddings; Qdrant collection/index management, organization filtering, version-aware deterministic point IDs, upsert/search, paginated scroll; candidate retrieval with `top_k * 5` capped at 200; backend integration for processing and authorization-safe retrieval; multi-tenant `organization_id` propagation; structured error responses (422/500); SSRF protection; graceful Qdrant shutdown.

**2026-10-06 fixes:** stale vectors on same-version reprocessing; tables and images never indexed; SSRF in downloader; missing exception handlers; `/retrieve` before first upload; `get_version_points` silent truncation; `EMBEDDING_MODEL` ignored; whitespace-only queries; unsupported file downloads; Qdrant client not closing; aligned settings modules; `requirements.txt` gaps; dead code removed; missing package init; test script fixes.

## What we are going to do

1. End-to-end test with a local Qdrant collection and a real sample document.
2. Processing status reporting, retries, and metrics.
3. Multi-tenant isolation tests (verify `organization_id` filtering).
4. Backend `authorizeQueryDocuments` must verify the user belongs to the organization.
5. Enforce `MIN_CHUNK_SIZE` in chunking.
6. Hybrid search and reranking after filtered retrieval works.
7. Grounded LLM generation, citations, and evaluation after authorization-safe retrieval is complete.
8. Consolidate the two settings modules.

## Constraints for Future Changes

- Do not expose Qdrant search directly to end users.
- Do not treat Qdrant payload metadata as the source of truth for authorization.
- Do not pass retrieved text to an LLM until backend-authorized document/version filtering is applied.
- Preserve the separation between extraction, chunking, embedding, and vector-store services.
- Docling failure must remain a warning, not an error.
