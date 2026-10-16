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
| 8 | Production Hardening | Completed | Atomic transitions, idempotency, duplicate handling, cleanup, test suite (57 tests as of 2026-10-13; 43 tests at the 2026-10-12 milestone) |
| 9 | Migration & Verification | In Progress | Migration applied (20261012100000_unique_active_document_access_policy); live infrastructure verification pending |
| 10 | Evaluation & Monitoring | In Progress | Metrics, logging, observability, evaluation framework |
| 11 | Deployment | Not Started | CI/CD, infrastructure as code, production deployment |

### Known Backend Issues

The following issues are tracked in the **Open Issues** section below and should be addressed before production deployment:

- **Critical**: Redis TLS configuration breaks local development (`src/config/redis.js`) — **Fixed 2026-10-13**
- **Critical**: Missing `processingError` column for failure diagnostics — **Fixed 2026-10-13**
- **Critical**: Metrics buffer never flushed on graceful shutdown — **Fixed 2026-10-13**
- **Critical**: CORS wide open with no origin restrictions — **Fixed 2026-10-13**
- **High**: Redis single point of failure
- **High**: QueryHistory unbounded growth — **Fixed 2026-10-13**
- **High**: Qdrant vector orphans on permanent cleanup — **Fixed 2026-10-13** (AI service `deleteDocumentVectors` added)
- **Medium**: Access-scope fingerprint performance overhead
- **Medium**: No tenant-wide default MANAGE_ACCESS policies — **Fixed 2026-10-13** (OrganizationDefaultAccessPolicy model added)
- **Medium**: Cleanup ordering not schema-enforced — **Fixed 2026-10-13** (DB triggers for cleanup ordering)
- **Medium**: Dual revocation representation (isActive + revokedAt) — **Fixed 2026-10-13** (Prisma middleware sync)
- **Medium**: BullMQ vs Redis client offline queue mismatch — **Fixed 2026-10-13**

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
- **Duplicate-job handling.** `processDocument` enters `PROCESSING` from `SUBMITTED`, `QUEUED`, or `FAILED`; a `PROCESSING` document can only be reclaimed if its status has been unchanged for at least 10 minutes. This supports BullMQ stalled-job retries without allowing a second worker to take over a recently claimed document.
- **Recovery of stranded publications.** `recoverStrandedPublications` runs at startup and re-dispatches any document left in `SUBMITTED`. The guarded `PROCESSING` write makes redundant dispatches harmless.
- **Recovery of stranded processing.** `recoverStaleProcessingDocuments` requeues documents left in `PROCESSING` without an active BullMQ job after 10 minutes. It runs at startup and every five minutes when Redis is enabled; per-document Redis locks and guarded database updates prevent duplicate recovery.
- **Processing-state guards.** `uploadDocumentVersion` requires the document to be `READY` before transitioning to `QUEUED`; `restoreDocument` restores to `READY` only when the current version's `processingStatus` is `READY`, otherwise to `FAILED`.
- **Dispatch-failure recovery.** If dispatch fails after publication or version upload, the document/version is moved to `FAILED` in a guarded transaction so it is recoverable via `reprocessDocument`.
- **Cleanup ordering.** Permanent cleanup nulls `currentVersionId` before deleting versions (the `onDelete: Restrict` relation requires it), then deletes policies, audit rows, S3 objects, and the document. Expired drafts are cleaned via `POST /documents/cleanup/expired-drafts`.
- **Known gap:** permanent cleanup deletes S3 objects and DB records but leaves orphaned Qdrant vectors; the AI service has no cleanup endpoint.

### Rate-Limiter Outage Policies

- The token-bucket rate limiter (`rateLimit.middleware.js`) uses a Lua script. On Redis outage, behavior follows `RATE_LIMIT_UNAVAILABLE_POLICY`: `open` (default) allows the request through; `closed` rejects with 503.
- Login and registration rate limits (`authRateLimit.service.js`) fail open on Redis errors so authentication remains available.
- **Known Issue**: Redis TLS configuration (`src/config/redis.js:10-16`) enables TLS unconditionally when username/password is set, breaking local Redis without TLS. See **Open Issues** → Critical #1.

### Error Handling and Query-History Persistence

- Query history stores only each authenticated user's query and guarded answer. `GET /query/history` filters by both the user's organization and user ID and returns pages for incremental conversation loading. A history-write failure fails the query request rather than returning an unpersisted answer as success.
- Successful generated answers and insufficient-evidence fallback answers are recorded. Requests that fail before producing an answer are not stored.
- **Known Issue**: Metrics buffer (`src/services/metrics/metricsBuffer.service.js`) has a `shutdown()` function but it's never called on process exit; metrics are lost on graceful shutdown. See **Open Issues** → Critical #3.

### Verified Reliability Mechanisms

- Atomic publication transaction with post-commit dispatch and dispatch-failure recovery to `FAILED`.
- Idempotent publish retries and duplicate-job no-ops.
- Startup recovery of stranded `SUBMITTED` publications.
- Startup and periodic recovery of stale `PROCESSING` documents when no matching active worker job exists.
- Guarded `PROCESSING` writes preventing duplicate processing.
- Version-aware restore on `restoreDocument`.
- Query-history write failure tolerance.
- Rate-limiter outage policies (open/closed).

**Unverified behavior:** no automated test exercises BullMQ worker dispatch under concurrent load, Redis connection/TLS configuration, or end-to-end query flow against live Qdrant/AI service.

**Known Gaps (see Open Issues):**
- ~~Redis TLS configuration breaks local development~~ — **Fixed**
- ~~Missing `processingError` column for failure diagnostics~~ — **Fixed**
- ~~Metrics buffer never flushed on graceful shutdown~~ — **Fixed**
- ~~CORS wide open with no origin restrictions~~ — **Fixed**
- Qdrant vector orphans on permanent cleanup — **Fixed** (AI service endpoint added, backend integration complete)
- QueryHistory unbounded growth — **Fixed** (cleanup job scheduled)

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
| 2026-10-13 | **Phase 7 — Multi-chunk-type retrieval:** AI service chunking preserves `chunk_type` + type-specific metadata (tables, formulas, figures, code); retrieval schema returns `chunk_type`; backend `contextGuard` formats typed chunks for LLM; evidence service detects structured evidence; frontend renders typed sources |

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

## What We Are Going to Do

| Item | Status |
| --- | --- |
| Phase 10 — Evaluation & Monitoring | In progress |
| Phase 11 — Deployment | Not started |
| Apply migration `20261012100000_unique_active_document_access_policy` | **Completed 2026-10-13** — `npx prisma migrate deploy` (fixed IMMUTABLE function requirement) |
| Live verification (real Redis, AI service, Qdrant, database) | Pending |
| Frontend document-management polish and retrieval interface | **Phase 7 complete** |
| Processing failure reasons (`processingError` column) | **Completed 2026-10-13** |
| AI service formula extraction (LaTeX) | Planned — extraction exists but not yet chunked separately |
| AI service code block extraction (language detection) | Planned |
| **Fix Redis TLS configuration for local development** | **Completed 2026-10-13** |
| **Add `processingError` column to DocumentVersion** | **Completed 2026-10-13** |
| **Call metricsBuffer.shutdown() on graceful exit** | **Completed 2026-10-13** |
| **Configure CORS with explicit origins** | **Completed 2026-10-13** |
| Add QueryHistory retention policy / cleanup job | **Completed 2026-10-13** |
| Add Qdrant vector cleanup endpoint to AI service | **Completed 2026-10-13** |
| Add tenant-wide default MANAGE_ACCESS policies | **Completed 2026-10-13** |
| Schema-enforced cleanup ordering | **Completed 2026-10-13** |
| Consolidate dual revocation representation | **Completed 2026-10-13** |
| Align BullMQ/Redis offline queue settings | **Completed 2026-10-13** |
| Add Helmet CSP/HSTS configuration | **Completed 2026-10-13** |
| Validate JWT_SECRET at startup | **Completed 2026-10-13** |
| Standardize ApiError with reasonCode | **Completed 2026-10-13** |
| Add request ID propagation for tracing | **Completed 2026-10-13** |
| Add rate limiting to all auth mutation endpoints | **Completed 2026-10-13** |
| Conditional Prisma logging by NODE_ENV | **Completed 2026-10-13** |
| Add dependency health checks to /health | **Completed 2026-10-13** |
| Document API versioning strategy | Low |
| Deduplicate startup re-dispatch | **Completed 2026-10-13** |
| Custom multer file size error message | **Completed 2026-10-13** |
| S3 orphan cleanup job / lifecycle policies | **Completed 2026-10-13** (daily reminder + S3 lifecycle docs) |
| Implement password reset / email verification | Enhancement |

## Open Issues

### Critical / High Priority

1. **Redis TLS Configuration Breaks Local Development** (`src/config/redis.js:10-16`)
   - TLS is enabled unconditionally when `REDIS_USERNAME` or `REDIS_PASSWORD` is set
   - Local Redis instances typically don't support TLS, causing connection failures
   - **Fix**: Make TLS configurable via `REDIS_TLS` env var; only enable when explicitly set to `true`
   - **Files to change**: `src/config/redis.js`, `src/config/config.js` (add REDIS_TLS), `.env.example`

2. **Missing `processingError` Column in `DocumentVersion`** (Prisma schema)
   - Processing failures only logged, not persisted; UI cannot display failure reasons
   - **Fix**: Add `processingError String?` field to `DocumentVersion` model; populate in `markProcessingFailed`
   - **Files to change**: `prisma/schema.prisma`, `src/services/document/documentProcessing.service.js` (markProcessingFailed), create migration

3. **Metrics Buffer Never Flushed on Graceful Shutdown** (`src/services/metrics/metricsBuffer.service.js`)
   - `shutdown()` function exists but never called; metrics lost on process exit
   - **Fix**: Add signal handlers in `server.js` to call `metricsBuffer.shutdown()` before exit
   - **Files to change**: `server.js`, `src/services/metrics/metricsBuffer.service.js`

4. **CORS Wide Open** (`src/app.js:13`)
   - `app.use(cors())` allows all origins; security risk in production
   - **Fix**: Configure explicit `origin`, `credentials`, and `methods` from env
   - **Files to change**: `src/app.js`, `src/config/config.js` (add CORS_ORIGIN, CORS_CREDENTIALS)

### Medium Priority

5. **Redis Single Point of Failure**
   - All rate limiting, caching, and queueing depend on single Redis instance
   - Outage behavior controlled by `RATE_LIMIT_UNAVAILABLE_POLICY` (open/closed)
   - **Mitigation**: Document failover strategy; consider Redis Sentinel/Cluster

6. **Access-Scope Fingerprint Performance** (`src/services/document/documentAccess.service.js:1030-1106`)
   - Full policy scan + unit hierarchy walk per query (~50-100ms overhead)
   - **Optimization**: Consider caching hierarchy; incremental fingerprint updates

7. **QueryHistory Unbounded Growth** (Prisma schema `QueryHistory`)
   - No retention policy; table grows indefinitely
   - **Fix**: Add scheduled cleanup job; `createdAt` index exists for efficient deletion

8. **No Tenant-Wide Default `MANAGE_ACCESS` Policies**
   - Currently per-document only; admins must grant per document
   - **Enhancement**: Add organization-level default access policies

9. **Cleanup Ordering Not Schema-Enforced** (`src/services/document/documentHelpers.js:144-160`)
   - `currentVersionId` must be nulled before version deletion (onDelete: Restrict)
   - Convention only; race conditions possible
   - **Fix**: Add DB-level check constraint or use transaction ordering guarantees

10. **Dual Revocation Representation** (`DocumentAccessPolicy` model)
    - Both `isActive` and `revokedAt` track revocation; must stay in sync
    - **Fix**: Use single source of truth; derive `isActive` from `revokedAt` null check

11. **Qdrant Vector Orphans on Permanent Cleanup** (`src/services/document/documentLifecycle.service.js:592-617`)
    - `cleanupDeletedDocument` deletes S3 + DB but leaves vectors in Qdrant
    - AI service has no cleanup endpoint
    - **Fix**: Add `DELETE /api/v1/documents/{id}/vectors` to AI service; call from backend

12. **Redis URL and BullMQ Reconnection** — **Resolved 2026-10-16**
    - `REDIS_URL` is parsed into Redis connection options; URL TLS and database selection are honored.
    - The application Redis client fails fast while BullMQ queues workers' commands during a reconnect.
    - Both clients retry transient connection failures.

### Low Priority / Enhancements

13. **Missing Helmet Configuration** (`src/app.js`)
    - Helmet imported but not configured with CSP, HSTS, etc.
    - **Fix**: Add `app.use(helmet({ contentSecurityPolicy: ... }))`

14. **No JWT Secret Validation at Startup** (`src/config/config.js:16`)
    - Missing `JWT_SECRET` causes runtime failures only when first used
    - **Fix**: Validate required env vars in `config.js` or `server.js` startup

15. **Inconsistent `reasonCode` in ApiError** (`src/middleware/error.middleware.js:32`)
    - Error handler reads `err.reasonCode` but not all `ApiError` throws set it
    - **Fix**: Add `reasonCode` parameter to `ApiError` constructor; update all throw sites

16. **No Request ID Propagation for Distributed Tracing**
    - `generateRequestId()` exists but not attached to request/response headers
    - **Fix**: Add middleware to generate/propagate `X-Request-ID`

17. **Missing Rate Limiting on Sensitive Auth Endpoints**
    - Only `/login` and `/register` rate limited; no protection for password reset, email change
    - **Fix**: Add rate limiters to all auth mutation endpoints

18. **Prisma Verbose Logging in Production** (`src/config/prisma.js:4`)
    - Logs all queries, info, warn, error; impacts performance
    - **Fix**: Conditional logging based on `NODE_ENV`

19. **Health Check Endpoint Lacks Dependency Status** (`src/controllers/health.controller.js`)
    - Returns basic status only; no DB/Redis/AI service connectivity checks
    - **Fix**: Add dependency health checks with timeout

20. **No API Versioning Strategy Beyond URL Prefix**
    - Routes mounted at `/api/v1` but no deprecation/versioning policy
    - **Enhancement**: Document versioning strategy; add `Accept` header versioning

21. **Inconsistent Error Handling Patterns**
    - Some services throw `ApiError`, others throw raw `Error`
    - **Fix**: Standardize on `ApiError` with consistent status codes

22. **Re-dispatch Not Deduplicated** (`src/services/document/documentLifecycle.service.js:551-590`)
    - Startup recovery re-dispatches all `SUBMITTED` documents
    - Guarded `PROCESSING` write makes duplicates harmless but wastes resources
    - **Optimization**: Track dispatched jobs in Redis to avoid duplicate queue adds

23. **Missing File Size Error Message in Multer** (`src/middleware/upload.middleware.js:11`)
    - `LIMIT_FILE_SIZE` handled in error middleware but no custom message
    - **Fix**: Add `fileFilter` or custom error handling for size limits

24. **Potential Race in Document Version Upload** (`src/services/document/documentLifecycle.service.js:689-742`)
    - Gap between S3 upload and DB transaction; orphaned S3 objects on crash
    - Current cleanup only handles transaction failures, not process crashes
    - **Fix**: Implement S3 lifecycle policies; periodic orphan cleanup job

25. **No Password Reset / Email Verification Flow**
    - Auth flow incomplete; users cannot reset passwords or verify emails
    - **Enhancement**: Implement secure password reset tokens; email verification on registration

### Test Coverage Gaps (from DEVELOPMENT.md)

- Rate limiting under load
- BullMQ worker dispatch under concurrent load
- Redis connection/TLS configuration
- End-to-end query flow against live Qdrant/AI service
- Authorized-cache fingerprint collision resistance and Redis SCAN/DEL invalidation path
- Permission revocation propagation to the authorized cache
- Policy expiry between requests
- Revocation during a query
- Invalidation racing with cache reads
- Processing-failure diagnostics (`processingError` column is planned, not implemented)
- Query-history retention policy
- Qdrant vector cleanup after permanent document deletion

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
| `REDIS_URL` | — | Redis connection URL (`redis://` or `rediss://`); overrides host, port, and URL credentials |
| `REDIS_HOST` | — | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_USERNAME` | — | Redis username |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_TLS` | `false` | Enable TLS for Redis (set `true` for managed Redis with TLS) |
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
| `CORS_ORIGIN` | `*` | Allowed CORS origin(s); comma-separated for multiple |
| `CORS_CREDENTIALS` | `true` | Allow credentials in CORS requests |

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
    "sources": [
        { 
            "index": 1, 
            "chunkId": "...", 
            "documentId": "...", 
            "versionId": "...", 
            "pageNumber": 1, 
            "score": 0.9,
            "chunkType": "text",
            "metadata": {}
        }
    ],
    "evidence": { 
        "sufficient": true, 
        "reason": "SUFFICIENT_EVIDENCE",
        "hasStructuredEvidence": false
    },
    "usedLLM": true,
    "outputGuardPassed": true
}
```

Evidence reasons: `SUFFICIENT_EVIDENCE`, `SUFFICIENT_EVIDENCE_WITH_STRUCTURED`, `NO_AUTHORIZED_EVIDENCE`, `NO_USABLE_EVIDENCE`, `LOW_RELEVANCE`.

**Chunk types** (`chunkType` + `metadata`):
- `text` — plain text
- `table` — `metadata: { markdown, headers[], rows[][] }`
- `formula` — `metadata: { latex }`
- `figure` / `image` — `metadata: { caption, description }`
- `code` — `metadata: { language }`

`GET /query/history` returns only the calling user's entries within their own organization, newest first; it never exposes `organizationId` or `userId`.

## Verification Levels

| Level | Meaning |
| --- | --- |
| **Implemented** | Code exists; `node --check` / module import succeeds |
| **Unit/integration tested** | Covered by `backend/tests/` with injected stubs for AI, Redis, Prisma, S3 |
| **Verified against live database** | Executed against the development database (rolled back or backed up) |
| **Production-verified** | Exercised with real users and live Redis/AI/Qdrant — nothing yet |

Current state: query contract, lifecycle, authorization, queue/Redis hardening — implemented and integration tested. Migration `20261012100000_unique_active_document_access_policy` **applied 2026-10-13** (fixed IMMUTABLE function requirement for expression index). Live-infrastructure verification pending.

## Backend Structure

```text
backend/
├── prisma/
├── scripts/bench-redis.mjs
├── server.js                  # startup: recovery, queue init, routes, graceful shutdown
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
- **Structured evidence detection (`SUFFICIENT_EVIDENCE_WITH_STRUCTURED`)** — `evidence.service.js`, `queryPipeline.test.js` (tests cover `NO_USABLE_EVIDENCE`, `LOW_RELEVANCE`; structured evidence reason added in Phase 7).

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
- **Redis TLS configuration for local development**.
- **Graceful shutdown metrics flush**.
- **CORS origin restriction validation**.
- **JWT_SECRET validation at startup**.
- **Request ID propagation for distributed tracing**.
- **Health check dependency status verification**.

**Test methodology:** all automated tests use injected stubs for AI, Redis, Prisma, and S3. No live infrastructure (PostgreSQL, Redis, Qdrant, AI service, or LLM provider) is exercised by the test suite. Distinguish automated stub-based tests from verification against live infrastructure, which is pending.

Names, purposes, and schema changes: `docs/DATABASE.md` — Migrations. Eleven are recorded; the eleventh (`20261012100000_unique_active_document_access_policy`) **applied 2026-10-13** — required IMMUTABLE wrapper functions for enum casts in expression index.
