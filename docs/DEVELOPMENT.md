# Enterprise RAG Backend

Backend implementation log for the Enterprise RAG Platform.

- Database design: `docs/DATABASE.md`
- AI service: `docs/ai-service.md`
- Frontend: `docs/frontendDevelopmentLog.md`

## Architecture

```text
React frontend
    │  HTTPS /api/v1
    ▼
Express backend (Node.js) ── Redis (cache, rate limits, queue)
    │  Prisma                       │
    ▼                               ▼
PostgreSQL (source of truth)    BullMQ worker
                                    │
    ┌───────────────┐               ▼
    ▼               ▼          AI service (FastAPI)
  S3 (files)   Qdrant (vectors)      │
                                    ▼
                              Qdrant (vectors)
```

- **PostgreSQL** is the authority for users, organizations, documents, versions, and access policies.
- **S3** stores document files; **Qdrant** stores embeddings.
- **Redis** powers the query caches, rate limiters, and the processing queue.
- The backend decides who may access what. The AI service never contains authorization logic.

## How it works

**Document processing**

```text
Create draft (DRAFT) → upload file → publish (SUBMITTED) → dispatch (QUEUED)
→ worker pickup (PROCESSING) → AI service extracts, chunks, embeds, indexes
→ READY or FAILED
```

**Query** — `POST /api/v1/query`

```text
Validate → check authorized cache → AI service retrieves candidates
→ authorize each document → rerank → evidence sufficiency check
→ build prompt → LLM → output guardrail → save history → respond
```

Response is exactly `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`. When evidence is insufficient, the backend returns a fallback answer without calling the LLM.

**Authorization**: every document read and every retrieval candidate is checked against `DocumentAccessPolicy` rows. DENY always wins; no matching policy means denied. Unauthorized content never reaches the LLM.

## What we did

| Date | Work |
| --- | --- |
| 2026-09-20 | Multi-tenant organization isolation |
| 2026-09-27 | Query history, version-aware caching, cache invalidation |
| 2026-09-28 | API rate limiting |
| 2026-09-30 | Processing worker, reprocessing, authorized retrieval cache, login rate limiting, cleanup |
| 2026-10-04 | Shared Redis client, document access authority, lifecycle authorization, processing state, permission revocation, invitation hardening |
| 2026-10-05 | Email normalization, failed-processing handling, version-upload safety, delegated access management, Redis latency benchmark |
| 2026-10-12 | Production-readiness pass (below) |

**2026-10-12 production-readiness pass:**

- Query response contract verified end-to-end (six fields, nothing else).
- Single authoritative lifecycle state machine in `documentHelpers.js`.
- `publishDraft`: guarded atomic transition, idempotent retries, dispatch-failure recovery to `FAILED`.
- `restoreDocument`: version-aware (restores to `READY` only when the current version is `READY`).
- Authorization: shared policy evaluation, batched document authorization (2 queries instead of N), `P2002` → 409.
- Queue/Redis: configurable fail-open/closed rate limiting, startup recovery of stranded publications, guarded `PROCESSING` writes (duplicate jobs become 409 no-ops).
- Dead code removed; 43-test suite added (`npm test`, Node built-in runner, no live infrastructure needed).

## What we are going to do

| Item | Status |
| --- | --- |
| Phase 10 — Evaluation & Monitoring | In progress |
| Phase 11 — Deployment | Not started |
| Apply migration `20261012100000_unique_active_document_access_policy` | Pending — `npx prisma migrate deploy` |
| Live verification (real Redis, AI service, Qdrant, database) | Pending |
| Frontend document-management polish and retrieval interface | In progress |
| Processing failure reasons (`processingError` column) | Planned |

## Open issues

- No `processingError` column — failure detail is log-only; the UI needs a persisted reason.
- Redis is a single dependency; outage behavior follows the configured fail-open/closed policy (`RATE_LIMIT_UNAVAILABLE_POLICY`).
- The access-scope fingerprint runs a full policy scan per query — correct, but a per-request cost.
- Re-dispatch is not deduplicated; the guarded `PROCESSING` write makes duplicates harmless no-ops.
- `QueryHistory` grows without bound; no retention policy.
- `MANAGE_ACCESS` policies are per-document; no tenant-wide default.
- Cleanup ordering (null `currentVersionId` before deleting versions) is conventional, not schema-enforced.
- Revocation is represented twice (`isActive` + `revokedAt`); both are kept in agreement.
- `redisConnection` sets TLS unconditionally — a problem for a plain local Redis.

## Setup

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
npm test
```

API base path: `/api/v1`

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | — | Server port |
| `NODE_ENV` | — | Application environment |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `JWT_SECRET` | — | JWT signing secret |
| `JWT_EXPIRES_IN` | — | Token expiry |
| `AWS_REGION` | — | Amazon S3 region |
| `AWS_ACCESS_KEY_ID` | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
| `AWS_S3_BUCKET` | — | Document storage bucket |
| `REDIS_ENABLED` | — | Enable or disable Redis |
| `REDIS_HOST` | — | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_USERNAME` | — | Redis username |
| `REDIS_PASSWORD` | — | Redis password |
| `AI_SERVICE_URL` | — | FastAPI AI service endpoint |
| `LLM_PROVIDER` | — | LLM provider |
| `LLM_MODEL_ID` | — | Bedrock model ID |
| `LLM_REGION` | — | Bedrock AWS region |
| `LLM_MAX_TOKENS` | — | Maximum LLM response tokens |
| `LLM_TEMPERATURE` | — | LLM temperature |
| `QUERY_RATE_LIMIT_CAPACITY` | `30` | Query bucket size |
| `QUERY_RATE_LIMIT_REFILL_RATE` | `0.5` | Query tokens per interval |
| `QUERY_RATE_LIMIT_REFILL_INTERVAL` | `1` | Query refill interval (seconds) |
| `DOCUMENT_UPLOAD_RATE_LIMIT_CAPACITY` | `10` | Upload bucket size |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_RATE` | `1` | Upload tokens per interval |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_INTERVAL` | `60` | Upload refill interval (seconds) |
| `RATE_LIMIT_UNAVAILABLE_POLICY` | `open` | Rate limiting during a Redis outage: `open` (allow) or `closed` (503) |

## API Endpoints

All routes require authentication unless noted. Base path `/api/v1`.

```text
# Health
GET    /health

# Authentication
POST   /auth/register
POST   /auth/login          (login rate limited: 5 per email, 20 per IP, 15 min)
GET    /auth/me

# Organization
GET    /organization            PATCH  /organization
POST   /organization            GET    /organization/revision
GET    /organization/units      POST   /organization/units
PATCH  /organization/units/:unitId           PATCH /organization/units/:unitId/move
PATCH  /organization/units/:unitId/capacity  DELETE /organization/units/:unitId
GET    /organization/members    PATCH  /organization/members/:memberId/role
PATCH  /organization/members/:memberId/unit  DELETE /organization/members/:memberId

# Permissions
GET    /permissions/me
GET    /permissions/members/:memberId
POST   /permissions
PATCH  /permissions/:permissionGrantId/revoke

# Invitations
GET    /invitations             POST   /invitations
GET    /invitations/received    PATCH  /invitations/:invitationId/revoke
POST   /invitations/:invitationId/accept

# Documents
GET    /documents                       GET    /documents/:documentId
PATCH  /documents/:documentId           DELETE /documents/:documentId
PATCH  /documents/:documentId/restore   DELETE /documents/:documentId/cleanup

# Drafts
POST   /documents/drafts
POST   /documents/drafts/:documentId/upload
DELETE /documents/drafts/:documentId/upload
POST   /documents/drafts/:documentId/publish
POST   /documents/cleanup/expired-drafts

# Versions
GET    /documents/:documentId/versions
GET    /documents/:documentId/versions/:versionId
POST   /documents/:documentId/versions
POST   /documents/:documentId/versions/:versionId/reprocess
GET    /documents/:documentId/download
GET    /documents/:documentId/versions/:versionId/download

# Access
POST   /documents/:documentId/access
POST   /documents/:documentId/access/temporary
GET    /documents/:documentId/access
GET    /documents/:documentId/access/history
GET    /documents/access/:policyId
PATCH  /documents/access/:policyId
DELETE /documents/access/:policyId

# Query
POST   /query
GET    /query/history         (limit 1–100 default 20, offset default 0)
```

### `POST /query`

Request: `{ query, topK (1–20) }`. Response:

```json
{
    "query": "...",
    "answer": "...",
    "sources": [{ "documentId": "...", "relevanceScore": 0.9 }],
    "evidence": { "sufficient": true, "reason": "SUFFICIENT_EVIDENCE" },
    "usedLLM": true,
    "outputGuardPassed": true
}
```

Evidence reasons: `SUFFICIENT_EVIDENCE`, `NO_AUTHORIZED_EVIDENCE`, `NO_USABLE_EVIDENCE`, `LOW_RELEVANCE`.

`GET /query/history` returns only the calling user's entries within their own organization, newest first; it never exposes `organizationId` or `userId`.

## Verification Levels

| Level | Meaning |
| --- | --- |
| **Implemented** | Code exists; `node --check` / module import succeeds |
| **Unit/integration tested** | Covered by `backend/tests/` with injected stubs for AI, Redis, Prisma, S3 |
| **Verified against live database** | Executed against the development database (rolled back or backed up) |
| **Production-verified** | Exercised with real users and live Redis/AI/Qdrant — nothing yet |

Current state: query contract, lifecycle, authorization, queue/Redis hardening — implemented and integration tested. Migration `20261012100000_unique_active_document_access_policy` written but **not applied**. Live-infrastructure verification pending.

## Backend Structure

```text
backend/
├── prisma/
├── scripts/bench-redis.mjs
├── server.js                  # startup: recovery, queue init, routes
└── src/
    ├── app.js
    ├── config/                # config, prisma, redis, bullmq, s3, ai
    ├── controllers/           # auth, document, health, invitation,
    │                          #   organization, permission, query, queryHistory
    ├── middleware/            # auth, error, rate limits, upload, notFound
    ├── routes/
    ├── services/
    │   ├── auth.services.js, authRateLimit.service.js
    │   ├── document.service.js, invitation.service.js
    │   ├── organization.service.js, permission.service.js, s3.service.js
    │   ├── document/          # documentAccess, documentAI, documentHelpers,
    │   │                      #   documentLifecycle, documentProcessing,
    │   │                      #   documentProcessingDispatcher, documentQueue
    │   └── query/             # answer, answerValidation, contextGuard,
    │                          #   evidence, llm, outputGuardrail, prompt,
    │                          #   query, queryAI, queryAccessCache, queryCache,
    │                          #   queryHistory, reranking
    ├── workers/document.worker.js
    └── utils/                 # ApiError, ApiResponse, asyncHandler, email,
                               #   fileValidation, jwt, password, serializeBigInt
```

## Migrations

Names, purposes, and schema changes: `docs/DATABASE.md` — Migrations. Eleven are recorded; the eleventh (`20261012100000_unique_active_document_access_policy`) is pending application with `npx prisma migrate deploy`.
