# Enterprise RAG Backend

Backend implementation log for the Enterprise RAG Platform.

## Phase Overview

| Phase | Title | Status | Description |
| --- | --- | --- | --- |
| 1 | Foundation & Database | Completed | PostgreSQL schema, Prisma setup, multi-tenant organization isolation |
| 2 | Authentication & Authorization | Completed | JWT auth, login rate limiting, RBAC, document access policies |
| 3 | Document Core | Completed | Drafts, versions, upload, publish, lifecycle state machine |
| 4 | Processing Pipeline | Completed | BullMQ worker, AI service integration, chunking, embedding, indexing |
| 5 | Query Engine | Completed | Retrieval, reranking, evidence evaluation, LLM generation, citations |
| 6 | Caching & Performance | Completed | Query cache, authorized cache, Redis integration, cache invalidation |
| 7 | API Rate Limiting | Completed | Token bucket rate limiting, fail-open/closed policies |
| 8 | Production Hardening | Completed | Atomic transitions, idempotency, duplicate handling, cleanup, test suite (57 tests as of 2026-10-12; 43 tests at the 2026-10-12 milestone) |
| 9 | Migration & Verification | In Progress | Apply pending migration, live infrastructure verification |
| 10 | Evaluation & Monitoring | In Progress | Metrics, logging, observability, evaluation framework |
| 11 | Deployment | Not Started | CI/CD, infrastructure as code, production deployment |

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

## Backend Architecture and Reliability

### Component responsibilities

| Component | Responsibility | Verified in source |
| --- | --- | --- |
| Express controllers | Request handlers that validate input, call services, and serialize responses. `query.controller.js` enforces the 6-field response contract. | `backend/src/controllers/` |
| Express routes | Mount route definitions under `/api/v1`. | `backend/src/routes/index.js` |
| Express middleware | `authenticate` (JWT + PostgreSQL user load, rejects inactive accounts), upload validation, rate limiting, error handling, 404. | `backend/src/middleware/` |
| Services | Business logic, organized under `services/document/` (lifecycle, access, processing) and `services/query/` (retrieval, caching, guardrails, LLM, history). | `backend/src/services/` |
| PostgreSQL + Prisma | Source of truth for users, organizations, documents, versions, access policies, audit, query history, and permission grants. | `backend/src/config/prisma.js` |
| Redis | Query caches, token-bucket rate limiters, login/registration counters, and the BullMQ queue. | `backend/src/config/redis.js` |
| BullMQ | Document-processing jobs and workers with retries. | `backend/src/config/bullmq.js`, `backend/src/workers/document.worker.js` |
| S3 | Draft and versioned document files; presigned URLs for authorized downloads. | `backend/src/services/s3.service.js` |
| Backend-to-AI-service integration | `queryAI.service.js` POSTs `/api/v1/retrieve`; `documentAI.service.js` POSTs `/api/v1/process-document`. The AI service is retrieval infrastructure only. | `backend/src/services/query/queryAI.service.js`, `backend/src/services/document/documentAI.service.js` |

### Document lifecycle, versioning, publication, retries, and cleanup

- **Atomic lifecycle transitions.** All state changes are validated against the single authoritative table in `documentHelpers.js` (`validDocumentTransitions`). API-initiated transitions use `validateDocumentTransition`; worker-initiated transitions use guarded conditional `updateMany` writes that only match allowed source states.
- **Idempotent publishing.** `publishDraft` retries after a successful publication return the already-published document instead of an error. The guarded `updateMany` (where `status = 'DRAFT'`) ensures only one concurrent publication creates the initial policies and audit records.
- **Duplicate-job handling.** `processDocument` enters `PROCESSING` only from `SUBMITTED`, `QUEUED`, or `FAILED`. A duplicate job for a document already in `PROCESSING` receives a 409 no-op.
- **Recovery of stranded publications.** `recoverStrandedPublications` runs at startup and re-dispatches any document left in `SUBMITTED`. The guarded `PROCESSING` write makes redundant dispatches harmless.
- **Processing-state guards.** `uploadDocumentVersion` requires the document to be `READY` before transitioning to `QUEUED`; `restoreDocument` restores to `READY` only when the current version's `processingStatus` is `READY`, otherwise to `FAILED`.
- **Dispatch-failure recovery.** If dispatch fails after publication or version upload, the document/version is moved to `FAILED` in a guarded transaction so it is recoverable via `reprocessDocument`.
- **Cleanup ordering.** Permanent cleanup nulls `currentVersionId` before deleting versions (the `onDelete: Restrict` relation requires it), then deletes policies, audit rows, S3 objects, and the document. Expired drafts are cleaned via `POST /documents/cleanup/expired-drafts`.
- **Known gap:** permanent cleanup deletes S3 objects and DB records but leaves orphaned Qdrant vectors; the AI service has no cleanup endpoint.

### Rate-limiter outage policies

- The token-bucket rate limiter (`rateLimit.middleware.js`) uses a Lua script. On Redis outage, behavior follows `RATE_LIMIT_UNAVAILABLE_POLICY`: `open` (default) allows the request through; `closed` rejects with 503.
- Login and registration rate limits (`authRateLimit.service.js`) fail open on Redis errors so authentication remains available.

### Error handling and query-history persistence

- Query history is persisted after the output guardrail, with the guarded answer. A history-write failure is logged and does not fail the response.
- Every query attempt is recorded, including LLM failures and guardrail blocks.

### Verified reliability mechanisms

- Atomic publication transaction with post-commit dispatch and dispatch-failure recovery to `FAILED`.
- Idempotent publish retries and duplicate-job no-ops.
- Startup recovery of stranded `SUBMITTED` publications.
- Guarded `PROCESSING` writes preventing duplicate processing.
- Version-aware restore on `restoreDocument`.
- Query-history write failure tolerance.
- Rate-limiter outage policies (open/closed).

**Unverified behavior:** no automated test exercises BullMQ worker dispatch under concurrent load, Redis connection/TLS configuration, or end-to-end query flow against live Qdrant/AI service.

## How it works

**Document processing**

```text
Create draft (DRAFT) → upload file → publish (SUBMITTED) → dispatch (QUEUED)
→ worker pickup (PROCESSING) → AI service extracts, chunks, embeds, indexes
→ READY or FAILED
```

**Query** — `POST /api/v1/query`

```text
Validate → check raw query cache → check authorized cache → AI service retrieves candidates
→ validate document/version IDs → authorize documents (authorizeQueryDocuments)
→ authorize candidates (authorizeCandidates: version match + policy eval) → rerank (score)
→ evidence sufficiency check → build safe context (length-limited) → build prompt → LLM
→ citation validation → output guardrail → save history → respond
```

Response is exactly `{ query, answer, sources, evidence, usedLLM, outputGuardPassed }`. When evidence is insufficient, the backend returns a fallback answer without calling the LLM. When the LLM output fails citation validation or the output guardrail, the answer is replaced with a safe fallback and `usedLLM`/`outputGuardPassed` are set accordingly. History records every attempt, including LLM failures and guardrail blocks.

**Authorization**: every document read and every retrieval candidate is checked against `DocumentAccessPolicy` rows. DENY always wins; no matching policy means denied. Unauthorized content never reaches the LLM.

## Authoritative Policy Evaluator

The single, shared authorization engine lives in `backend/src/services/document/documentAccess.service.js`. It is the only place where `DocumentAccessPolicy` rows are resolved against a user. Every authorization path — single-document actions, batched listings, query retrieval, and the access-scope fingerprint — resolves through the exported helpers below. No other module contains policy-matching logic.

### Responsibilities and call relationships

| Function | Exported | Role | Callers |
| --- | --- | --- | --- |
| `policyMatchesUser(policy, user, userUnitHierarchy)` | yes | Shared subject matcher. Returns `true` only when the policy is active (`isActive`, `validFrom`/`validUntil` window) and its subject matches the user. Unknown `subjectType` values return `false` — they never grant access. | `evaluatePolicyMatches`, `getQueryAccessScopeFingerprint` |
| `evaluatePolicyMatches(policies, user, userUnitHierarchy)` | yes | Filters a policy list to the active policies that match the user via `policyMatchesUser`. Inactive, revoked, expired, and not-yet-valid policies are skipped before matching. | `authorizeDocumentAction`, `authorizeDocumentsForAction`, `authorizeQueryDocuments`, `getQueryAccessScopeFingerprint` |
| `resolvePolicyDecision(matches)` | yes | Converts a match set into `allowed` or `denied`. Any matching `DENY` → `denied`; otherwise a matching `ALLOW` → `allowed`; an empty match set → `denied`. | `authorizeDocumentAction`, `authorizeDocumentsForAction`, `authorizeQueryDocuments` |
| `authorizeDocumentAction(user, documentId, action)` | yes | Single-document authorization. Loads the document, verifies the user belongs to an organization, fetches matching `action` policies for the user's organization, and throws 403 on denial. Used for `VIEW`, `DOWNLOAD`, and `MANAGE_ACCESS` checks on document read paths. | `documentLifecycle.service.js`, `documentAccess.service.js` (self), `documentProcessing.service.js` |
| `authorizeDocumentsForAction(user, documentIds, action)` | yes | Batched authorization for listing endpoints. Issues two queries total (one policy query, one unit-hierarchy walk) and evaluates every document in memory with the same matcher and decision rules as the single-document path. Returns a `Map` of `documentId → boolean`. | `documentLifecycle.service.js` (`getDocuments`) |
| `authorizeQueryDocuments(user, documentIds)` | yes | Query-retrieval authorization. Selects `Document` rows scoped to the user's `organizationId` with `isDeleted = false`, `status = 'READY'`, and `currentVersionId` not null (tenant isolation, lifecycle, soft-deletion enforced at the SQL level), then evaluates `action = 'QUERY'` policies. Returns `[{documentId, currentVersionId}]` pairs. | `query.service.js` (`authorizeCandidates`) |
| `getQueryAccessScopeFingerprint(user)` | yes | Computes a SHA-256 over the user's organization, unit, role, unit hierarchy, and the sorted set of matched `QUERY` policies (including `updatedAt`). Used as the authorized-cache key component so a cache hit can only serve a result computed under the exact same authorization state. | `query.service.js` (`retrieveAuthorizedCandidates`) |

### Authorization rules enforced by the evaluator

- **The backend owns authorization decisions** (implemented). PostgreSQL is the source of truth for document access policies. The AI service and Qdrant are retrieval infrastructure only; they filter by `organization_id` and cannot grant or expand access.
- **DENY overrides ALLOW** (implemented, unit-tested). A single matching `DENY` policy forces denial regardless of any number of matching `ALLOW` policies.
- **No matching applicable ALLOW means denied** (implemented, unit-tested). An empty match set is a denial (deny-by-default).
- **Inactive, revoked, expired, and not-yet-valid policies never grant access** (implemented, unit-tested). `isDocumentAccessPolicyActive` requires `isActive = true`, `revokedAt = null` (implied by `isActive`), `validFrom` in the past (or null), and `validUntil` in the future (or null).
- **Organization boundaries are enforced** (implemented, unit-tested). Every policy query is scoped to `organizationId = user.unit.organizationId`; cross-organization documents and policies are excluded at the SQL level.
- **Supported scopes are enforced** (implemented, unit-tested). `ORGANIZATION`, `UNIT` (with `UNIT_ONLY` or `UNIT_AND_DESCENDANTS`), `ROLE`, and `USER` are the only recognized subject types. `UNIT_AND_DESCENDANTS` walks the unit parent chain; `UNIT_ONLY` requires an exact unit match.
- **Unknown subject types never grant access** (implemented, unit-tested). `policyMatchesUser` returns `false` for any `subjectType` not in the supported set, so an unrecognized or missing subject type cannot accidentally allow access.
- **Single-document and batch authorization apply consistent decision semantics** (implemented, unit-tested). `authorizeDocumentAction`, `authorizeDocumentsForAction`, and `authorizeQueryDocuments` all resolve through `evaluatePolicyMatches` and `resolvePolicyDecision`; the regression test suite verifies their decisions agree.

## Critical RAG Security Invariant

**UNAUTHORIZED CONTENT MUST NEVER REACH THE LLM.** This rule is enforced by the backend query pipeline in `query.service.js`. Retrieved chunks are *candidates*, not authorized evidence. Four separate controls apply to every candidate before its text can reach a model:

1. **Document authorization** — `authorizeQueryDocuments` evaluates `DocumentAccessPolicy` rows for the `QUERY` action with deny-overrides-allow and deny-by-default semantics. The AI service's `organization_id` filter and Qdrant retrieval scores cannot grant access. (Implemented, unit-tested.)
2. **Chunk identity validation** — each candidate's `document_id` and `version_id` must be traceable to a PostgreSQL `Document` and `DocumentVersion` row. Candidates with missing, malformed, or unverifiable metadata are dropped. (Implemented, unit-tested.)
3. **Version validation** — a candidate is only usable when its `version_id` equals the document's current `Document.currentVersionId`. A matching `document_id` alone does not establish authorization or version freshness. (Implemented, unit-tested.)
4. **Prompt-injection defenses** — the system prompt instructs the model to treat all retrieved content as untrusted data and to refuse prompt-injection attempts; the output guardrail rejects answers containing prompt-extraction or chain-of-thought patterns; citation validation rejects `[Source N]` references to sources not in the authorized set. (Implemented, unit-tested.)

**Execution order (verified in `query.service.js`):** authenticate → resolve organization → validate query & rate limit → check raw retrieval cache → (on miss) AI-service retrieval → compute access-scope fingerprint → check authorized cache (with version revalidation) → (on miss) `authorizeCandidates` → rerank (score-based) → evidence sufficiency check → build safe context → build prompt → LLM → citation validation → output guardrail → save history → respond. Authorization and version validation occur *before* reranking, context construction, and LLM invocation.

**Discrepancy check:** the current implementation satisfies the invariant. No component consumes chunk text before authorization. The raw retrieval cache stores pre-authorization candidates only, and authorization is re-applied on every request regardless of cache state.

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

**2026-10-12 production-readiness pass** (a work-session name; it does **not** mean the platform is production-ready — deployment, live-infrastructure verification, and evaluation remain unfinished):

- Query response contract verified end-to-end (six fields, nothing else).
- Single authoritative lifecycle state machine in `documentHelpers.js`.
- `publishDraft`: guarded atomic transition, idempotent retries, dispatch-failure recovery to `FAILED`.
- `restoreDocument`: version-aware (restores to `READY` only when the current version is `READY`).
- Authorization: shared policy evaluation, batched document authorization (2 queries instead of N), `P2002` → 409.
- Queue/Redis: configurable fail-open/closed rate limiting, startup recovery of stranded publications, guarded `PROCESSING` writes (duplicate jobs become 409 no-ops).
- Dead code removed; test suite added (`npm test`, Node built-in runner, no live infrastructure needed). The suite grew from 43 tests at the 2026-10-12 milestone to 57 tests as of the current state — see Test Coverage.

## Cache Authorization and Revocation

Two Redis caches exist, both tenant-scoped to the user's organization, with distinct keying strategies and different authorization guarantees.

### Raw query cache (`rag:retrieval:{orgId}:{topK}:{queryHash}`, 300 s TTL)

- Stores the AI service's **raw candidate list**, keyed by organization + query + topK only. It is **not** user- or access-scope-scoped.
- A cache hit is candidate evidence, never authorized content. The backend always re-runs `authorizeQueryDocuments` (database policy evaluation) against the cached candidates before any of their text reaches a model.
- **The raw query cache is intentionally not invalidated on policy changes.** It stores pre-authorization candidates only, and authorization is re-applied on every request regardless of cache state.
- Successful document processing calls `invalidateOrganizationQueryCache(organizationId)`, which SCAN-deletes the entire `rag:retrieval:{orgId}:*` namespace so stale candidate lists are replaced.

### Authorized retrieval cache (`rag:authorized-retrieval:{orgId}:{scopeHash}:{topK}:{queryHash}`, 300 s TTL)

- Stores the **backend-authorized candidate set**, keyed by organization + the user's **access-scope fingerprint** + query + topK.
- On a hit, the stored candidates are re-validated against `Document.currentVersionId` by `validateCurrentCandidates` before reuse; stale versions are excluded and trigger a fresh authorization pass.

### `getQueryAccessScopeFingerprint`

Computes a SHA-256 over the user's organization ID, unit ID, role, sorted unit hierarchy, and the sorted set of matched `QUERY` policies (including `id`, `documentId`, subject fields, `effect`, `scope`, `validFrom`, `validUntil`, and `updatedAt`). It is recomputed per request and used as the authorized-cache key component so that a cache hit is only served when the current request's fingerprint matches the stored entry.

**Guarantee level:** the fingerprint captures the matched `QUERY` policies and the user's scope at computation time, and `updatedAt` is included so a policy update changes the fingerprint. **Verified:** the fingerprint is recomputed per request and the authorized cache is invalidated on every policy mutation (`grantDocumentAccess`, `updateDocumentAccessPolicy`, `revokeDocumentAccess`). **Not yet verified against live infrastructure:** that expiry, revocation, and invalidation behavior keep the cache authorization-safe under concurrent policy changes, or that the fingerprint is collision-resistant at scale.

**Limitation:** the fingerprint runs a full policy scan per query — correct, but a per-request cost. It is not incremental.

### Permission revocation and cache invalidation

- Any access-policy grant, update, or revoke calls `invalidateOrganizationAuthorizedQueryCache(organizationId)`, which SCAN-deletes the entire `rag:authorized-retrieval:{orgId}:*` namespace. This is verified in `documentAccess.service.js` (`grantDocumentAccess`, `updateDocumentAccessPolicy`, `revokeDocumentAccess`).
- The raw query cache is **not** invalidated on policy changes, by design: it stores pre-authorization candidates only, and authorization is re-applied on every request.

### Cache-hit validation

- Both caches return `null` on Redis errors (cache miss); the pipeline then falls through to live retrieval and authorization.
- If authorization state cannot be verified (no organization unit, Redis disabled, or policy query failure), the request is rejected (403) or re-runs authorization — never served from cache.

**Verified implementation:** the authorized cache key includes the access-scope fingerprint, and cached candidates are re-validated against current versions before reuse. **Unverified behavior:** no automated test exercises the Redis SCAN/DEL invalidation path or the authorized-cache fingerprint collision resistance against live Redis.

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
- Permanent cleanup deletes S3 objects and DB records but leaves orphaned Qdrant vectors; the AI service has no cleanup endpoint. Backend gap, not a frontend issue.

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
    "sources": [{ "index": 1, "chunkId": "...", "documentId": "...", "versionId": "...", "pageNumber": 1, "score": 0.9 }],
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

## Test Coverage

Tests run with the Node built-in test runner (`node --test backend/tests/*.test.js`). No live infrastructure (Redis, AI service, Qdrant, PostgreSQL) is required — all external dependencies are injected as stubs.

| File | Tests | What it covers | Status |
| --- | --- | --- | --- |
| `authorization.test.js` | 11 | `authorizeQueryDocuments` deny-overrides-allow, deny-by-default, batch lookup, invalid-document rejection, non-existent policy handling, UNIT scope matching (UNIT_ONLY/UNIT_AND_DESCENDANTS), inactive/expired policy exclusion, unknown subject-type rejection | Implemented / Tested |
| `authorizationRegression.test.js` | 14 | Single-document vs batch authorization consistency: ALLOW/DENY decisions agree, deny-overrides-allow deterministic, empty match set denial, inactive/expired/revoked policies ignored, wrong organization rejected, UNIT_ONLY and UNIT_AND_DESCENDANTS scope respected, role-based authorization consistent | Implemented / Tested |
| `queryPipeline.test.js` | 11 | 15-step orchestrator: response-contract validation, fallback answer on insufficient/no-evidence, NO_USABLE_EVIDENCE and LOW_RELEVANCE evidence reasons, cross-org exclusion, superseded-version exclusion, unauthorized content never reaching LLM, authorized cache-hit revalidation against current version, top-K reranked candidates only reaching generation, output guardrail blocking + blocked answer persisted, history-write failure tolerance | Implemented / Tested |
| `queryGuards.test.js` | 9 | `answerValidation` citation validation (in-range accepts, out-of-range rejects, empty answer rejects); `outputGuardrail` (safe answer passes, prompt-extraction blocks, chain-of-thought blocks, empty answer replaced with fallback); `answer.service.js` evidence fallback (no LLM called) and context fallback (empty prompt) | Implemented / Tested |
| `queryController.test.js` | 8 | Input validation (empty query, whitespace-only query, topK outside 1–20, non-integer topK), response contract (exactly 6 fields), insufficient-evidence fallback mapping, `asyncHandler` error forwarding | Implemented / Tested |
| `documentLifecycle.test.js` | 4 | Document lifecycle state machine: all valid transitions accepted, absent transitions rejected (400), FAILED→PROCESSING worker retry recovery, module reuse | Implemented / Tested |

**Coverage summary:** 57 tests, all passing with Node built-in runner. Cache-hit revalidation against current document versions is covered in `queryPipeline.test.js`. Authorization policy evaluation (batch mode, deny-overrides-allow, deny-by-default, UNIT scope matching) is covered in `authorization.test.js`. Single-document and batch authorization decision consistency is covered in `authorizationRegression.test.js`. The document lifecycle state machine is covered in `documentLifecycle.test.js`.

**Security and authorization guarantees verified in source code and tests:**

- DENY-overrides-allow and deny-by-default — `authorization.test.js`, `authorizationRegression.test.js`, `queryPipeline.test.js`.
- Organization and unit-scope matching (`UNIT_ONLY`, `UNIT_AND_DESCENDANTS`) — `authorization.test.js`, `authorizationRegression.test.js`.
- Expired, inactive, revoked, and not-yet-valid policy exclusion — `authorization.test.js`, `authorizationRegression.test.js`.
- Unknown subject-type rejection — `authorization.test.js`, `authorizationRegression.test.js`.
- Cross-organization and superseded-version exclusion — `queryPipeline.test.js`.
- Unauthorized content never reaching the LLM — `queryPipeline.test.js` (asserts the unauthorized candidate's text is absent from the prompt and the LLM input).
- Authorized cache-hit revalidation against current versions — `queryPipeline.test.js`.
- Evidence fallback and output guardrails — `queryGuards.test.js`, `queryPipeline.test.js`.
- Document lifecycle transitions — `documentLifecycle.test.js`.
- Response contract and input validation — `queryController.test.js`.

**Missing security and reliability tests (not covered by automated tests):**

- Rate limiting under load.
- BullMQ worker dispatch under concurrent load.
- Redis connection/TLS configuration.
- End-to-end query flow against live Qdrant/AI service.
- Authorized-cache fingerprint collision resistance and Redis SCAN/DEL invalidation path.
- Permission revocation propagation to the authorized cache.
- **Policy expiry between requests** — a `validUntil` that elapses between two queries must not be served from a cached authorized result.
- **Revocation during a query** — a `DENY` policy granted after a query's authorized-cache entry was written must not be served from that entry.
- **Invalidation racing with cache reads** — concurrent policy mutation and cache read must not return a stale authorized result.
- Processing-failure diagnostics (`processingError` column is planned, not implemented).
- Query-history retention policy.
- Qdrant vector cleanup after permanent document deletion.

**Test methodology:** all automated tests use injected stubs for AI, Redis, Prisma, and S3. No live infrastructure (PostgreSQL, Redis, Qdrant, AI service, or LLM provider) is exercised by the test suite. Distinguish automated stub-based tests from verification against live infrastructure, which is pending.

Names, purposes, and schema changes: `docs/DATABASE.md` — Migrations. Eleven are recorded; the eleventh (`20261012100000_unique_active_document_access_policy`) is pending application with `npx prisma migrate deploy`.
