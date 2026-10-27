# Backend Development Guide

The backend is the platform's **control plane**: it owns identity, tenant
boundaries, document lifecycle, authorization, query orchestration, and API
responses. The AI service handles document extraction, embeddings, and vector
search; it does not decide whether a user may see a document.

Use this guide to understand the backend, run it locally, and trace the two
critical flows: **document ingestion** and **question answering**.

## At a glance

| Concern | Implementation |
| --- | --- |
| HTTP API | Node.js, Express 5, ES modules |
| Relational source of truth | PostgreSQL through Prisma |
| Original files | Private Amazon S3 bucket; downloads use presigned URLs |
| Background processing | BullMQ on Redis when enabled; direct processing when Redis is disabled |
| Extraction, embeddings, vector search | FastAPI AI service and Supabase pgvector |
| Answer generation | Amazon Bedrock Converse API |
| Tests | Node.js built-in test runner with injected external dependencies |

```text
Frontend
   │  /api/v1
   ▼
Express backend ─────── PostgreSQL (Prisma)
   │   │   │
   │   │   └────────── Amazon S3 (private files)
   │   ├────────────── Redis (optional cache, rate limits, BullMQ)
   │   ├────────────── FastAPI AI service ───── Supabase pgvector
   │   └────────────── Amazon Bedrock (answers)
   │
   └── Authorization and lifecycle decisions stay in the backend
```

For schema and storage detail, see [DATABASE.md](./DATABASE.md). For the
AI service's own API and extraction behavior, see [ai-service.md](./ai-service.md).

## Two important pipelines

### 1. Document ingestion

```text
Authenticated upload
        │
        ▼
Create draft ── upload PDF / DOCX / TXT ──► Store file in S3
        │
        ▼
Publish draft / upload a new version
        │
        ▼
Guard document state and dispatch work
        │
        ├── Redis enabled ──► BullMQ queue ──► document worker
        └── Redis disabled ──────────────────► process in the API process
                                                   │
                                                   ▼
                                    Create a short-lived S3 download URL
                                                   │
                                                   ▼
                                  AI service: extract → normalize → chunk
                                            → embed → index in Supabase pgvector
                                                   │
                                                   ▼
                                  Mark current version READY or FAILED
```

1. The API validates the uploaded file (PDF, DOCX, or TXT; maximum 25 MB),
   stores it in S3, and tracks its metadata in PostgreSQL.
2. Publishing or adding a version advances the document lifecycle and dispatches
   processing. With Redis enabled, BullMQ uses three attempts with exponential
   backoff starting at five seconds. With Redis disabled, processing runs
   directly instead of being queued.
3. The worker (or direct path) claims the document, obtains a presigned S3
   download URL, and calls the AI service's `POST /api/v1/process-document`.
4. The AI service extracts content, creates chunks and embeddings, then indexes
   them in Supabase pgvector. The backend verifies the returned document and version IDs
   before marking the current version ready.
5. A successful processing run invalidates that organization's raw retrieval
   cache. Failures are recorded against the version and leave the document
   recoverable through reprocessing.

The document status and version processing status are separate:

| Document status | Meaning |
| --- | --- |
| `DRAFT` | Editable staging document |
| `SUBMITTED` | Published and awaiting dispatch |
| `QUEUED` | Waiting for processing |
| `PROCESSING` | A worker/direct processor has claimed the current version |
| `READY` | Current version is processed and eligible for authorized use |
| `FAILED` | Current processing attempt failed |
| `DELETED` | Soft-deleted |
| `EXPIRED` | Draft expired; terminal state |

At the version level, `processingStatus` progresses through `PENDING`,
`QUEUED`, `PROCESSING`, and either `COMPLETED` or `FAILED`. The allowed document
transitions are centralized in `documentHelpers.js`; update that state machine
when changing lifecycle behavior.

Startup recovery redispatches stranded publications and stale processing
records. With Redis enabled, stale-processing recovery also runs every five
minutes. Scheduled maintenance cleans old query history and expired drafts;
query-history retention defaults to 90 days and its cleanup interval defaults
to 24 hours. Graceful shutdown stops scheduled jobs, flushes buffered metrics,
and disconnects Prisma.

### 2. Question answering

```text
POST /api/v1/query
       │
       ▼
Authenticate ── rate limit ── validate query and topK (1–20; default 5)
       │
       ▼
Organization-scoped retrieval candidates
  ├── Redis raw-candidate cache, or
  └── AI service POST /api/v1/retrieve → Supabase pgvector
       │
       ▼
Backend authorization + tenant/status/current-version checks
       │
       ▼
Sort by retrieval score and keep topK
       │
       ▼
Evidence sufficiency check
   ├── Insufficient ──► guarded fallback answer
   └── Sufficient ────► safe context → prompt → Bedrock
                                            │
                                            ▼
                              answer validation and output guard
       │
       ▼
Persist per-user query history and return response
```

The query orchestrator in `services/query/query.service.js` owns this flow.
Retrieval returns **candidates**, not authorization decisions:

- AI retrieval is scoped to the user's organization, but pgvector is not the
  document-access authority.
- Before candidate text can enter an LLM prompt, the backend evaluates
  document-level `QUERY` access and checks that each document is active, ready,
  and still on the candidate's current version. Organization membership and
  administrative permissions alone do not grant document access.
- Candidates are sorted by retrieval score and truncated to `topK`. This is a
  score-based ordering step, not a separate learned reranker.
- Evidence is considered sufficient only when usable evidence exists and the
  leading score is at least `0.25`. Tables, formulas, and code are identified
  as structured evidence.
- Context construction removes NUL bytes from normalized plain-text chunks,
  clips those chunks at 4,000 characters, formats structured chunk metadata,
  and caps the full context at 18,000 characters. Source metadata is carried
  through for citations.
- The model is instructed to use only the supplied context. Generated answers
  are checked before returning; insufficient evidence produces a fixed
  fallback without calling the model.
- Query history is written before a successful response is returned. A history
  persistence failure is not treated as a successful answer.

Redis may cache raw retrieval candidates and authorized candidates (both with
five-minute TTLs). A raw-cache hit is never trusted as authorization: the
backend reevaluates access. Authorized cached candidates are rechecked against
the current ready document version. Policy changes invalidate the related
authorization cache. Redis cache failures are logged and treated as cache
bypasses/misses; they do not grant access.

The query response uses the standard API envelope. The `data` object contains
`query`, `answer`, `sources`, `evidence`, `usedLLM`, and `outputGuardPassed`.
`topK` must be an integer from 1 through 20.

## Security and authorization vocabulary

Keep these concepts distinct when changing or documenting access behavior:

| Term | What it controls |
| --- | --- |
| **Organization / tenant** | Data ownership and isolation boundary |
| **Organization unit** | A node in the organization's company/department/team/group hierarchy |
| **Role** | User classification such as `OWNER`, `ADMIN`, `MANAGER`, or `MEMBER` |
| **Permission grant** | Delegated authority to perform administrative actions |
| **Document access policy** | Whether a user, role, unit, or organization can perform an action on a document |
| **Classification** | Document sensitivity label (`GENERAL`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`); not an access grant |

Document access actions include `QUERY`, `VIEW`, `DOWNLOAD`, and
`MANAGE_ACCESS`. Access can be time-bounded and scoped to a unit or its
descendants. Authorization is enforced by the backend for every protected
operation; do not use vector-store payloads or frontend visibility as a
substitute.

## Local development

### Prerequisites

- A supported Node.js release for the installed project dependencies and npm.
- A PostgreSQL database reachable through `DATABASE_URL`.
- `JWT_SECRET` for token signing.
- For complete document/query flows: S3-compatible AWS access, the AI service,
  Supabase pgvector configured for that service, and Bedrock access.
- Redis is optional. Set `REDIS_ENABLED=true` only when a Redis instance is
  available; otherwise the backend bypasses Redis-backed features and processes
  documents in-process.

### Install and run

From PowerShell at the repository root:

```powershell
Set-Location backend
npm install
```

Create `backend/.env` with the required local settings below (and any
dependencies you intend to exercise), then apply migrations and start the API:

```powershell
npx prisma migrate dev
npm run dev
```

The API is mounted under `/api/v1`; its port comes from `PORT` (Express's
default is used if it is unset). The AI service has separate setup instructions
in [ai-service.md](./ai-service.md). Check `GET /api/v1/health` to see database,
Redis, and AI-service dependency status. Redis reports `disabled` when
`REDIS_ENABLED` is not `true`.

### Environment settings

Never commit `.env` files or real credentials. `DATABASE_URL` and `JWT_SECRET`
are checked by `server.js` at startup.

| Variable | Default / requirement | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Required | PostgreSQL connection used by Prisma |
| `JWT_SECRET` | Required | JWT signing secret |
| `JWT_EXPIRES_IN` | No application default | JWT lifetime passed to token signing |
| `PORT` | Express default if unset | HTTP port |
| `NODE_ENV` | Unset | Environment; controls CSP/HSTS and Prisma logging |
| `CORS_ORIGIN` | `*` | One or more allowed origins, comma-separated |
| `CORS_CREDENTIALS` | `false` | Set to `true` to allow credentialed CORS |
| `AWS_REGION` | Required for S3; `us-east-1` Bedrock fallback | AWS region for S3 and Bedrock |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Required for S3 operations | Explicit AWS credentials used by the S3 client |
| `AWS_S3_BUCKET` | Required for file operations | Private document bucket |
| `AI_SERVICE_URL` | Required for AI operations | Base URL of the FastAPI service |
| `LLM_MODEL_ID` | `amazon.nova-pro-v1:0` | Bedrock model ID |
| `LLM_MAX_TOKENS` | `1000` | Maximum answer tokens |
| `LLM_TEMPERATURE` | `0` | Bedrock inference temperature |
| `REDIS_ENABLED` | `false` | Enables Redis caches, rate limiting, queue, and worker |
| `REDIS_URL` | — | Redis URL (`redis://` or `rediss://`); takes precedence over host settings |
| `REDIS_HOST`, `REDIS_PORT` | Port `6379` | Redis host and port when no URL is supplied |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | — | Redis credentials when not embedded in the URL |
| `REDIS_TLS` | `false` | Enable TLS when using host settings |
| `RATE_LIMIT_UNAVAILABLE_POLICY` | `open` | On Redis rate-limit failure, `open` allows requests; `closed` rejects with 503 |
| `QUERY_RATE_LIMIT_CAPACITY` | `30` | Query token-bucket capacity |
| `QUERY_RATE_LIMIT_REFILL_RATE` | `0.5` | Query tokens added per refill interval |
| `QUERY_RATE_LIMIT_REFILL_INTERVAL` | `1` second | Query token refill interval |
| `DOCUMENT_UPLOAD_RATE_LIMIT_CAPACITY` | `10` | Upload token-bucket capacity |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_RATE` | `1` | Upload tokens added per refill interval |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_INTERVAL` | `60` seconds | Upload token refill interval |
| `LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS` | `5` | Login attempts per email |
| `LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS` | `20` | Login attempts per IP |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `900` | Login rate-limit window |
| `REGISTRATION_RATE_LIMIT_IP_MAX_ATTEMPTS` | `5` | Registration attempts per IP |
| `REGISTRATION_RATE_LIMIT_WINDOW_SECONDS` | `900` | Registration rate-limit window |
| `QUERY_HISTORY_RETENTION_DAYS` | `90` | Query-history retention period |
| `QUERY_HISTORY_CLEANUP_INTERVAL_HOURS` | `24` | Query-history cleanup interval |

## API surface

All paths below are relative to `/api/v1`. Registration and login are public;
`GET /health` is the health endpoint. Other routes require authentication.
Route middleware also applies endpoint-specific authorization, validation,
and rate limits.

| Route group | Paths |
| --- | --- |
| Health | `GET /health` |
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Organization | `/organization` (read/create/update), `/organization/revision`, `/organization/units`, `/organization/units/:unitId`, `/organization/units/:unitId/move`, `/organization/units/:unitId/capacity`, `/organization/units/:unitId/capacity` (GET), `/organization/members`, `/organization/members/:memberId/role`, `/organization/members/:memberId/unit`, `/organization/members/:memberId` |
| Administrative permissions | `GET /permissions/me`, `GET /permissions/members/:memberId`, `POST /permissions`, `PATCH /permissions/:permissionGrantId/revoke` |
| Invitations | `GET/POST /invitations`, `GET /invitations/received`, `PATCH /invitations/accept/:token`, `PATCH /invitations/:invitationId/revoke` |
| Documents and drafts | `GET /documents`, `GET/PATCH/DELETE /documents/:documentId`, `POST /documents/drafts`, `POST/DELETE /documents/drafts/:documentId/upload`, `POST /documents/drafts/:documentId/publish`, `POST /documents/cleanup/expired-drafts` |
| Versions and downloads | `GET /documents/:documentId/versions`, `GET /documents/:documentId/versions/:versionId`, `POST /documents/:documentId/versions`, `POST /documents/:documentId/versions/:versionId/reprocess`, `GET /documents/:documentId/download`, `GET /documents/:documentId/versions/:versionId/download` |
| Document access | `POST /documents/:documentId/access`, `POST /documents/:documentId/access/temporary`, `GET /documents/:documentId/access`, `GET /documents/:documentId/access/history`, `GET/PATCH/DELETE /documents/access/:policyId` |
| Query | `POST /query`, `GET /query/history` |

For exact request schemas and middleware order, the route and validator files
under `backend/src/routes/` and `backend/src/validators/` are authoritative.

## Code map

```text
backend/
├── server.js                    # Startup, dependency connection, recovery, shutdown
├── prisma/
│   ├── schema.prisma            # Database models and enums
│   └── migrations/              # Versioned PostgreSQL migrations
└── src/
    ├── app.js                    # Express middleware and API mounting
    ├── config/                   # Config, Prisma, Redis/BullMQ, S3 and AI clients
    ├── routes/                   # HTTP paths and middleware ordering
    ├── controllers/              # HTTP request/response adapters
    ├── middleware/               # Authentication, uploads, rate limits, errors, metrics
    ├── services/
    │   ├── document/             # Lifecycle, access policies, processing and dispatch
    │   ├── query/                # Retrieval, authorization, context, answer and history
    │   ├── metrics/              # Request/dependency metrics and buffering
    │   └── ...                   # Auth, organizations, permissions, invitations, S3
    ├── workers/document.worker.js
    ├── repositories/             # Data access modules
    ├── models/                   # Domain models
    └── utils/                    # Shared response, error, JWT and validation helpers
```

Typical request path: **route → middleware → controller → service → Prisma or
external client → `ApiResponse`**. Keep HTTP concerns in controllers and
business rules in services.

## Database and migrations

Prisma schema and migration history live in `backend/prisma/`. Use Prisma
migrations to evolve the PostgreSQL schema; do not hand-edit a deployed
database as a substitute for a checked-in migration.

```powershell
# Create/apply a migration during local schema development
npx prisma migrate dev --name describe_the_change

# Apply already-created migrations in a deployment environment
npx prisma migrate deploy
```

In both cases run from the `backend` directory and provide the correct
`DATABASE_URL`. Review generated SQL and preserve existing migration files.

## Tests and validation

Run tests from `backend`:

```powershell
npm test
```

The package uses Node's built-in test runner. Tests set `NODE_ENV=test` and
disable Redis before service modules load; Prisma, Redis, S3, and AI boundaries
are stubbed/injected where needed, so the suite does not require live
infrastructure.

Useful focused suites:

```powershell
node --test tests/queryPipeline.test.js
node --test tests/documentProcessing.test.js tests/documentLifecycle.test.js
node --test tests/authorization.test.js tests/authorizationRegression.test.js
```

Coverage is organized by behavior:

| Test file(s) | Focus |
| --- | --- |
| `queryPipeline.test.js`, `queryController.test.js`, `queryGuards.test.js` | Query orchestration, response contract, evidence and output guards |
| `queryHistory.test.js` | Per-user history access, pagination, retention |
| `authorization.test.js`, `authorizationRegression.test.js` | Document authorization and regression cases |
| `documentProcessing.test.js`, `documentLifecycle.test.js`, `documentAI.test.js` | Processing, lifecycle transitions, AI-service contract and recovery |
| `metrics.test.js`, `redisToggle.test.js` | Request/dependency metrics and Redis-enabled/disabled behavior |

Local tests demonstrate behavior against controlled dependencies; they do not
replace verification with a real PostgreSQL database, Redis, S3, Bedrock, AI
service, and Supabase pgvector.

## Operational notes

- `GET /api/v1/health` checks PostgreSQL, Redis (or reports it disabled), and
  the AI service. It returns `503` when an enabled dependency is unhealthy.
- Redis backs both caches, rate limiters, and BullMQ. If Redis is disabled,
  rate limiting and cached retrieval are bypassed and document processing is
  synchronous.
- Query caches are performance aids only. Never move authorization into a
  cache or trust cached vector results without backend checks.
- The request metrics middleware returns an `X-Request-ID` and records total
  request `durationMs`. Query metrics additionally include `rawCacheOutcome`
  and `authorizedCacheOutcome` (`HIT`, `MISS`, `BYPASS`, or `ERROR`); a null
  authorized-cache outcome means that lookup was not attempted.
- Login, registration, query, and document-upload rate limits have separate
  settings. When Redis is unavailable, `RATE_LIMIT_UNAVAILABLE_POLICY` controls
  the token-bucket middleware; login/registration have their own Redis behavior.
- During shutdown, scheduled jobs stop before the HTTP server closes; buffered
  metrics are flushed and Prisma is disconnected.
