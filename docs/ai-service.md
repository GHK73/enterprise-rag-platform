# AI Service Handoff

Copy this document into a new AI chat when working on the AI service.

## Project Context

This repository is an enterprise RAG platform with three applications:

```text
frontend/    React + Vite user interface
backend/     Node.js + Express API, Prisma, S3, Redis/BullMQ
ai-service/  FastAPI document-processing and vector-indexing service
```

The AI service lives in `ai-service/`. Its current purpose is to convert an uploaded document into Qdrant vectors. It does not currently provide a complete retrieval or RAG-generation API.

## Progress Summary

### Completed

- FastAPI application setup, logging, root endpoint, and health endpoint.
- Temporary workspace creation, file download, and cleanup.
- PDF, DOCX, and TXT extraction, with optional Docling enrichment.
- Content normalization and page-based character chunking.
- Sentence Transformer embedding generation with CPU fallback and CUDA detection.
- Qdrant collection creation, payload indexing, deterministic point IDs, upsert, inspection, deletion, and basic vector search methods.
- Backend helper for building a presigned S3 download payload and calling the AI service.

### In Progress

- Document-processing API integration: the route implementation exists, but its router is not registered in `app/api/index.py`.
- End-to-end verification using real documents, Qdrant, and the backend processing flow.
- Finalizing document-version behavior: the service has version-level operations, but the active processing flow deletes all vectors for a document before re-indexing.

### Remaining

- Processing job status, retry handling, metrics, and structured failure reporting.
- Retrieval API with backend-authorized document and version filters.
- Hybrid retrieval, reranking, score handling, and context construction.
- Grounded LLM generation, citations, and response streaming.
- Retrieval and generation evaluation, monitoring, and performance testing.

## AI Service Responsibilities

Implemented pipeline:

```text
Presigned document URL
  -> download to temporary workspace
  -> extract PDF, DOCX, or TXT content
  -> optionally merge additional Docling extraction
  -> normalize document blocks
  -> create chunks
  -> generate Sentence Transformer embeddings
  -> ensure Qdrant collection and indexes exist
  -> delete existing vectors for the document
  -> upsert new Qdrant points
  -> remove temporary files
```

The service must not make business authorization decisions. The backend is intended to determine which documents and versions a user may process or retrieve.

## Important File Map

```text
ai-service/
  app/
    main.py                         FastAPI app and lifespan
    api/
      index.py                      `/api/v1` router; currently includes health only
      health.py                     GET `/api/v1/health`
      processing.py                 POST `/process-document` route definition
    config/
      config.py                     Settings used by main app and health endpoint
      settings.py                   Settings used by Qdrant vector store
      logger.py                     Logging setup
    schemas/
      processing.py                 ProcessDocumentRequest and response models
      document.py                   Internal document, page, and block models
      chunk.py                      Chunk-related schemas
      retrieval.py                  Retrieval schemas; no complete routed feature yet
    services/
      processing/
        service.py                  Orchestrates the entire processing pipeline
        downloader.py               Downloads the file URL with httpx
        temp_storage.py             Creates and removes temporary workspaces
        extraction.py               Selects and merges extractors
        normalization.py            Normalizes extracted content
        chunking.py                 Page-based character chunking
      extractors/
        pdf.py                      PyMuPDF extractor
        docx.py                     python-docx extractor
        txt.py                      Text extractor
        docling.py                  Optional Docling extraction
        base.py                     Extractor base types
        table.py                    Table helpers
      embedding/
        service.py                  SentenceTransformer embedding service
      vectorstore/
        qdrant.py                   Async Qdrant collection, upsert, search, deletion
  requirements.txt                  Python dependencies
  test_processing.py                Processing tests or experiments
  test_chunking.py                  Chunking tests
  test_pdf_extractor.py             PDF extraction tests
```

Note: `app/services/processing/__intit__.py` appears to be misspelled, and `app/api/__` is an unusual placeholder file. Check imports before changing package behavior.

## FastAPI Routes

Available now:

```text
GET /
GET /api/v1/health
```

Defined but not registered:

```text
POST /api/v1/process-document
```

`app/api/processing.py` defines the processing route, but `app/api/index.py` imports and includes only the health router. Register the processing router before expecting this endpoint to work.

The intended processing request is:

```json
{
  "document_id": "application-document-id",
  "version_id": "immutable-version-id",
  "file_url": "https://short-lived-presigned-url/document.pdf"
}
```

## Backend Integration

The backend helper is `backend/src/services/document/documentAI.service.js`.

It:

1. Creates a presigned S3 download URL using `getDownloadUrlFromS3(version.storageKey)`.
2. Builds `document_id`, `version_id`, and `file_url`.
3. Sends the payload to `${config.ai.url}/process-document`.

Check the configured `config.ai.url` before integration testing. The backend path and the FastAPI route must agree: the FastAPI route is intended to be under `/api/v1`, while the backend helper currently calls `/process-document` directly.

## Processing Details

### Extraction

Supported input extensions are `.pdf`, `.docx`, and `.txt`. Unsupported extensions fail before extraction. The primary extractor runs first. Docling is attempted afterward; a Docling failure is logged as a warning and does not fail the pipeline.

### Chunking

`ChunkingService` uses page-by-page, character-based chunks:

```text
chunk size:    1000 characters
chunk overlap:  200 characters
chunk ID:      chunk_000000, chunk_000001, ...
```

Chunks contain text, page number, associated block IDs, and metadata. This is not token-aware, section-aware, or semantic chunking yet.

### Embeddings

`EmbeddingService` uses Sentence Transformers with the default model `all-MiniLM-L6-v2`.

```text
batch size:       32
normalization:    enabled
GPU:              CUDA when PyTorch detects it
CPU fallback:     enabled
vector dimension: detected from the model; 384 for all-MiniLM-L6-v2
```

The model is instantiated during import, so startup can download/load the model and take time.

### Qdrant

`QdrantVectorStore` uses `AsyncQdrantClient` and the collection name in `QDRANT_COLLECTION`.

Collection behavior:

- Creates the collection if missing.
- Uses cosine distance.
- Creates payload indexes for `document_id`, `version_id`, and `chunk_id`.
- Creates deterministic UUIDv5 point IDs from document ID, version ID, and chunk ID.
- Stores `document_id`, `version_id`, `chunk_id`, `page_number`, `text`, `block_ids`, and metadata in each payload.
- Supports upsert, unfiltered vector search, version inspection, version deletion, document deletion, and client close.

Important current behavior: `DocumentProcessingService.process_document()` calls `delete_document(document_id)` before upserting. Therefore processing a new version removes all prior indexed vectors for that document. Although the vector store has version-level methods, historical document versions are not currently retained by the processing flow.

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

There are two settings modules:

- `app/config/config.py` is used by `main.py` and the health route.
- `app/config/settings.py` is used by Qdrant.

Keep common values aligned. Consolidating these modules is a useful cleanup task.

## Local Development

```powershell
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Main dependencies include FastAPI, httpx, PyMuPDF, python-docx, Sentence Transformers, PyTorch, and qdrant-client.

## Current Gaps and Recommended Next Work

1. Register `processing_router` in `app/api/index.py` and align its route with the backend URL.
2. Add an end-to-end test using a local or test Qdrant collection and a real sample document.
3. Decide version semantics. Use `delete_version(document_id, version_id)` if historical indexed versions must remain queryable.
4. Add processing status reporting, retries, structured error responses, and metrics.
5. Create a retrieval endpoint that accepts only backend-authorized document/version filters and passes those filters to Qdrant.
6. Add hybrid search and reranking after filtered retrieval works.
7. Add grounded LLM generation, citations, and evaluation only after authorization-safe retrieval is complete.

## Constraints for Future Changes

- Do not expose Qdrant search directly to end users.
- Do not treat Qdrant payload metadata as the source of truth for authorization.
- Do not pass retrieved text to an LLM until backend-authorized document/version filtering is applied.
- Preserve the separation between extraction, chunking, embedding, and vector-store services.
