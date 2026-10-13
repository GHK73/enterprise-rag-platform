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

~~~text
Backend POST /api/v1/query
  → AI service POST /api/v1/retrieve { query, organization_id, top_k }
      → ensure collection → embed query
      → search Qdrant (candidate_limit = min(top_k * 5, 200))
      ← RetrievalResponse { query, results[] }
  → backend validates each result's document_id and version_id
  → backend authorizes document_ids via policy checks
  → backend filters candidates to authorized documents
  → backend reranks and generates answer with LLM
~~~

The AI service intentionally retrieves **more** candidates than `top_k` (`CANDIDATE_MULTIPLIER = 5`, capped at `MAX_CANDIDATES = 200`) because backend authorization narrows the set. The AI service filters by `organization_id` only — it does not and cannot apply document-level access policies.

**Chunk metadata contract.** Every Qdrant point stores a payload and every retrieval result returns the following fields:

| Field | Stored in Qdrant | Returned by /retrieve | Used by backend for |
| --- | --- | --- | --- |
| `organization_id` | Yes (keyword index) | No | AI-service tenant filter only |
| `document_id` | Yes (keyword index) | Yes | Document identity → authorization lookup |
| `version_id` | Yes (keyword index) | Yes | Version freshness check against `Document.currentVersionId` |
| `chunk_id` | Yes (keyword index) | Yes | Source citation in the LLM prompt |
| `page_number` | Yes | Yes | Source citation |
| `text` | Yes | Yes | Document content passed to LLM (after authorization) |
| `block_ids` | Yes | Yes | Source traceability |
| `metadata` | Yes | Yes | Diagnostic context + **chunk_type** + type-specific fields |
| `score` | — | Yes | Reranking (score-based sort only) |

**`metadata` fields by `chunk_type`:**
- `text` — `{ chunk_index, page_number, block_count, character_count }`
- `table` — adds `{ markdown, headers[], rows[][], chunk_type: "table" }`
- `formula` — adds `{ latex, chunk_type: "formula" }`
- `figure` / `image` — adds `{ caption, description, chunk_type: "figure"|"image" }`
- `code` — adds `{ language, chunk_type: "code" }`

**Authorization boundary.** Qdrant retrieval results are candidate evidence, not proof of authorization. The backend validates each `document_id` against a PostgreSQL `Document` row (organization match, `isDeleted = false`, `status = 'READY'`, `currentVersionId` not null) and then evaluates `DocumentAccessPolicy` rows for the `QUERY` action with deny-overrides-allow and deny-by-default semantics. Chunks whose `version_id` does not match the document's current version are discarded before reranking or generation. No document text from an unauthorized or stale candidate ever reaches a model.

The AI service does contain `filter_authorized_candidates()` and `select_top_k()` helpers on `RetrievalService`, but these are **not called by the backend** — the backend performs authorization itself via `authorizeQueryDocuments` and `authorizeCandidates` in `query.service.js` and `documentAccess.service.js`. These helpers exist as unused utilities and must not be relied upon for authorization.

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

**Chunk types preserved in `metadata.chunk_type`:**
- `text` — plain text
- `table` — markdown representation in `metadata.markdown`, `headers[]`, `rows[][]`
- `formula` — LaTeX in `metadata.latex`
- `figure` / `image` — `metadata.caption`, `metadata.description`
- `code` — `metadata.language`

Tables render as markdown-style text; images/figures use `caption` or `ocr_text`; formulas use `latex`.

**Embeddings** — Sentence Transformers, `EMBEDDING_MODEL` (default `all-MiniLM-L6-v2`, 384 dimensions), batch size 32, normalized, CUDA when available. The model loads at import, so startup can take time.

**Qdrant** — `AsyncQdrantClient`. Creates the collection if missing (cosine distance) with payload indexes on `document_id`, `version_id`, `chunk_id`, `organization_id`. Point IDs are deterministic UUIDv5 hashes of `document_id:version_id:chunk_id`, so reprocessing overwrites the same points while versions stay separate. `process_document()` calls `delete_version()` before `upsert_chunks()` so same-version reprocessing leaves no stale vectors.

**Retrieval service** — `retrieve_candidates(request)` ensures the collection, embeds the query, searches with `candidate_limit = min(top_k * 5, 200)` filtered by `organization_id`. Returns `chunk_type` and type-specific `metadata` for each result. Backend-side authorization is **not** performed here.

## Backend Integration

`backend/src/services/document/documentAI.service.js` creates a presigned S3 URL and sends `{ document_id, version_id, organization_id, file_url, file_name }` to `${config.ai.url}/api/v1/process-document`. `config.ai.url` must contain only the base URL, without a trailing `/api/v1`.

The query flow lives in `backend/src/services/query/`:

- `queryAI.service.js` — POSTs `/api/v1/retrieve` with `{ query, organization_id, top_k }`; a 30 s timeout applies.
- `query.service.js` — orchestrates: cache → retrieve → validate document IDs → authorize → filter by version → rerank → evidence sufficiency → safe context → prompt → LLM → citation validation → output guardrail → save history.
- `query.controller.js` — validates input (non-empty query, `topK` 1–20), invokes the orchestrator, returns `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`.

Two independent guardrails run after LLM generation: citation validation (`answerValidation.service.js`, rejects `[Source N]` references to unauthorized sources) and the output guardrail (`outputGuardrail.service.js`, rejects answers containing prompt-extraction or chain-of-thought patterns). History is saved even when evidence is insufficient or the guardrail blocks the answer — the record is marked `usedLLM: false` or `outputGuardPassed: false` accordingly.

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

Implemented: FastAPI processing and retrieval routes; PDF/DOCX/TXT extraction with Docling fallback; block normalization and chunking (**chunk types preserved: text, table, formula, figure, image, code with type-specific metadata**); Sentence Transformer embeddings; Qdrant collection/index management, organization filtering, version-aware deterministic point IDs, upsert/search, paginated scroll; candidate retrieval with `top_k * 5` capped at 200 (returns `chunk_type` + metadata); backend integration for processing and authorization-safe retrieval; multi-tenant `organization_id` propagation; structured error responses (422/500); SSRF protection; graceful Qdrant shutdown.

**2026-10-06 fixes:** stale vectors on same-version reprocessing; tables and images never indexed; SSRF in downloader; missing exception handlers; `/retrieve` before first upload; `get_version_points` silent truncation; `EMBEDDING_MODEL` ignored; whitespace-only queries; unsupported file downloads; Qdrant client not closing; aligned settings modules; `requirements.txt` gaps; dead code removed; missing package init; test script fixes.

**2026-10-13 Phase 7:** chunking preserves `chunk_type` + type-specific metadata (markdown tables, LaTeX formulas, captions, code language); retrieval schema includes `chunk_type`; `/retrieve` returns typed chunks.

## What we are going to do

1. ~~End-to-end test with a local Qdrant collection and a real sample document~~ — backend integration is in place; the backend calls `/retrieve` and authorizes results. Full end-to-end with a live Qdrant cluster and real indexed documents is pending live verification.
2. Processing status reporting, retries, and metrics — `processingError` column is planned; the backend exposes no failure reason, progress, or queue position today.
3. ~~Multi-tenant isolation tests (verify `organization_id` filtering)~~ — the backend's `authorizeQueryDocuments` scopes every policy query to the user's organization; the AI service filters Qdrant by `organization_id`.
4. ~~Backend `authorizeQueryDocuments` must verify the user belongs to the organization~~ — implemented: it queries `DocumentAccessPolicy` with `organizationId: user.unit.organizationId` and rejects users without a unit (403).
5. Enforce `MIN_CHUNK_SIZE` in chunking — defined as 100 in `app/config/chunking.py` but not yet enforced in `ChunkingService.chunk()`.
6. Hybrid search and reranking after filtered retrieval works — reranking is score-based only; model-based reranking is deferred.
7. Grounded LLM generation, citations, and evaluation after authorization-safe retrieval is complete — the backend calls Bedrock Converse with a system prompt and validates citations and output guardrails. Evaluation framework is not started.
8. Consolidate the two settings modules (`config.py` and `settings.py`) — still pending.
9. Formula extraction (LaTeX) — pdfplumber/PDFMiner extraction exists but LaTeX not yet in chunks.
10. Code block extraction (language detection) — heuristics needed for monospace/font detection.

## Constraints for Future Changes

- Do not expose Qdrant search directly to end users.
- Do not treat Qdrant payload metadata as the source of truth for authorization.
- Do not pass retrieved text to an LLM until backend-authorized document/version filtering is applied.
- Preserve the separation between extraction, chunking, embedding, and vector-store services.
- Docling failure must remain a warning, not an error.
- The AI service's own `filter_authorized_candidates()` and `select_top_k()` methods are convenience utilities, not authorization boundaries. The backend must always independently authorize via PostgreSQL before any document text reaches a model.
