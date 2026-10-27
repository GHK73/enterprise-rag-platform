# AI Service

The AI service is the document-ingestion and vector-retrieval component of this
repository's RAG platform. It is a FastAPI application that extracts searchable
content from documents, creates embeddings, stores chunks in Supabase pgvector, and returns
retrieval candidates to the backend.

> **Security boundary:** This service filters vector searches by organization,
> but it does not authorize access to individual documents and does not generate
> answers. The backend must authorize each candidate and check its current
> document version before using its text in an LLM prompt.

## Start the service

### Windows PowerShell

From the repository root:

```powershell
cd ai-service
py -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, use the Python executable
directly instead:

```powershell
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Create `ai-service/.env` with your Supabase PostgreSQL connection setting (see
[Configuration](#configuration)), then start the API from the `ai-service`
directory:

```powershell
python -m uvicorn app.main:app --reload
```

Uvicorn serves locally at `http://127.0.0.1:8000` by default. The first startup
can take longer because the Sentence Transformers model is loaded when the
application imports its embedding service; the model may also need to be
downloaded the first time.

Check that the service is running:

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/api/v1/health
http://127.0.0.1:8000/docs
```

For a deployment that must accept connections from outside the local machine,
pass an explicit host and port to Uvicorn, for example:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The `HOST` and `PORT` environment settings are defined in the application
configuration, but Uvicorn does not read them automatically in the command
above. Use Uvicorn's `--host` and `--port` options to control its bind address.

## What the service does

```text
Document processing
Backend ── POST /api/v1/process-document ──> AI service
                                                │
                         validate + download file
                                                │
                         extract → normalize → chunk
                                                │
                         embed → index chunks in Supabase pgvector
                                                │
Backend <──────────── processing result ────────┘

Question retrieval
Backend ── POST /api/v1/retrieve ───────────> AI service
                                                │
                              embed the query
                                                │
                       search pgvector by organization
                                                │
Backend <──── ranked candidate chunks + text ───┘
   │
   └── validate document/version and authorize candidates
       before reranking, prompt construction, and answer generation
```

The AI service does not connect directly to the frontend. The backend
orchestrates document processing and query handling, applies access policies,
and generates user-facing answers.

## Document-processing pipeline

The `POST /api/v1/process-document` route validates a
`ProcessDocumentRequest`, then runs these stages:

1. **Validate the file type.** The `file_name` suffix must be `.pdf`, `.docx`,
   or `.txt`. The service uses this name to choose the extractor; it does not
   infer the file type from the download URL.
2. **Download to a temporary workspace.** The downloader accepts HTTP/HTTPS
   URLs, checks the URL before requesting it, streams the response to disk, and
   uses a 60-second HTTP timeout.
3. **Extract document blocks.**
   - PDF: PyMuPDF extracts text and image blocks; table extraction tries
     Camelot first and pdfplumber if Camelot finds no tables.
   - DOCX: python-docx extracts paragraphs, tables, and image references.
     Physical page layout is not preserved; the extracted content is placed on
     page 1.
   - TXT: UTF-8 text is split into paragraphs and represented on page 1.
   - Docling is attempted only when the primary extractor returns no blocks.
     If Docling also returns no content or fails, the primary extractor's
     result is returned. An error raised by the primary extractor is not
     automatically retried with Docling.
4. **Normalize blocks.** Text whitespace and line endings are cleaned; table
   cells are flattened and trimmed; image captions and OCR text are trimmed
   when present.
5. **Create page-scoped chunks.** Text, table contents, and figure/image
   captions or OCR text are converted to searchable text. Chunks target 1,000
   characters with a 200-character overlap. Oversized blocks are split into
   smaller chunks. Chunk IDs follow the form `chunk_000000`.
6. **Generate embeddings.** The configured Sentence Transformers model encodes
   chunks in batches of 32. Embeddings are normalized and use CUDA when it is
   available; otherwise, the service uses CPU.
7. **Index the version in pgvector.** The service deletes existing rows for the
   same document and version, then upserts the new chunks.
8. **Clean up.** The temporary workspace is removed whether processing
   succeeds or fails.

The processing endpoint returns success status, a message, and the document
and version IDs. It does not return extracted text or chunks.

### Current extraction and chunking scope

The document schema defines additional block types, but the current chunker
only turns text blocks, tables, and image/figure blocks with a caption or OCR
text into searchable content. A PDF image with neither caption nor OCR text
does not become a searchable chunk. Formula and code blocks are not currently
produced by the primary extractors or converted into searchable chunks.

Chunk metadata includes the chunk index, page number, block count, character
count, and derived chunk type. Table chunks also carry table headers, rows, and
a Markdown representation.

## Retrieval pipeline

The `POST /api/v1/retrieve` route accepts:

| Field | Requirement |
| --- | --- |
| `query` | Required, non-empty, and not whitespace-only |
| `organization_id` | Required |
| `top_k` | Optional; defaults to `5`; must be between `1` and `50` |

The service connects to the Supabase pgvector table, embeds the query, and searches
only rows whose `organization_id` matches the request. To leave room for
backend authorization to filter out inaccessible documents, it requests
`min(top_k * 5, 200)` candidates. The response includes candidate text, score,
document and version IDs, page and chunk IDs, block IDs, and metadata.

`top_k` is therefore used to calculate a candidate search limit; this endpoint
does not authorize documents or guarantee that the response contains exactly
`top_k` authorized chunks. Document-level authorization and any final selection
belong to the backend.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | Basic service name, version, and running status |
| `GET` | `/api/v1/health` | Health response with service, version, and environment |
| `POST` | `/api/v1/process-document` | Download, process, embed, and index one document version |
| `POST` | `/api/v1/retrieve` | Return organization-scoped pgvector candidates for a query |

FastAPI's interactive API documentation is available at `/docs` while the
service is running.

Validation errors are returned with HTTP `422`. Unhandled exceptions are
logged and returned as a generic HTTP `500` response.

## pgvector data model

Each indexed row in `public.ai_document_chunks` contains a 384-dimensional
embedding and the chunk fields below:

| Payload field | Purpose |
| --- | --- |
| `organization_id` | Organization filter for vector search |
| `document_id`, `version_id` | Backend document and freshness checks |
| `chunk_id`, `page_number`, `block_ids` | Chunk identity and source traceability |
| `text` | Candidate text returned to the backend |
| `metadata` | Chunk type and type-specific processing details |

The HNSW index uses cosine distance. B-tree indexes support organization and
document-version filtering. Row IDs remain deterministic UUIDv5 values derived
from the document, version, and chunk IDs. The table and vector extension are
created by the backend Prisma migration.

## Backend integration and authorization

The backend configures the AI service base URL with `AI_SERVICE_URL`. Set it to
the service's base address, without appending `/api/v1`; the backend adds the
route path for each request.

- Document processing is called by
  `backend/src/services/document/documentAI.service.js`.
- Retrieval is called by `backend/src/services/query/queryAI.service.js`.
- Query orchestration and access checks live under
  `backend/src/services/query/`.

pgvector results are **candidates, not authorization decisions**. Before
candidate text can be used for answer generation, the backend must verify that
each document belongs to the requesting user's organization, is available and
not deleted, and that the result's version is current. The backend then applies
document access policies and filters unauthorized candidates. Do not expose
direct vector retrieval to end users or pass unapproved candidate text to an
LLM.

## Configuration

Create an `.env` file in the `ai-service` directory. Set
`PGVECTOR_DATABASE_URL` to the Supabase session-pooler connection URL used for
Prisma migrations (the `DIRECT_URL` from `backend/.env`). The AI service opens a
small async connection pool and requires TLS.

```dotenv
APP_NAME="Enterprise RAG AI Service"
APP_VERSION="1.0.0"
ENVIRONMENT="development"
HOST="127.0.0.1"
PORT=8000
LOG_LEVEL="INFO"
EMBEDDING_MODEL="all-MiniLM-L6-v2"
PGVECTOR_DATABASE_URL="postgresql://..."
PGVECTOR_POOL_SIZE=5
```

Before starting the AI service, apply migrations from `backend` with
`npx prisma migrate deploy`. Keep real credentials out of source control. The
application and vector-store settings both read `.env` from the current working
directory, so start Uvicorn from `ai-service`.

Existing Qdrant points are not queried after this change. If the old Qdrant
cluster is reachable, copy its points with
`python -m scripts.migrate_qdrant_to_pgvector` from `ai-service`; the script
needs the old `QDRANT_URL`, `QDRANT_API_KEY`, and `QDRANT_COLLECTION` values in
the local environment. Otherwise, reprocess the existing documents to create
their embeddings in Supabase.

## Tests and developer scripts

The root-level Python scripts are manual developer utilities rather than a
configured automated test suite:

| Command (from `ai-service`) | Purpose |
| --- | --- |
| `python test_pdf_extractor.py` | Extract and print blocks from `test_files/sample.pdf` |
| `python test_chunking.py` | Run extraction, normalization, and chunking on the sample PDF |
| `python test_processing.py` | Exercise full processing; the script's current loopback URL is rejected by the SSRF guard, so replace it with an allowed reachable file URL first |
| `python -m scripts.migrate_qdrant_to_pgvector` | One-time copy of the old Qdrant points into pgvector |

The end-to-end processing script requires working external services and
configuration. The migration utility reads the configured Qdrant collection and
writes its points to the Supabase pgvector table.

## Source map

| Area | Location |
| --- | --- |
| FastAPI application and lifecycle | `app/main.py` |
| HTTP routes | `app/api/` |
| Request and response schemas | `app/schemas/` |
| File download, extraction, normalization, chunking | `app/services/processing/` and `app/services/extractors/` |
| Embedding generation | `app/services/embedding/` |
| Candidate retrieval | `app/services/retrieval/` |
| pgvector persistence and similarity search | `app/services/vectorstore/` |
| Runtime settings and logging | `app/config/` |
