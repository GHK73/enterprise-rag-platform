# Enterprise RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend.

Database design: `docs/DATABASE.md`

---

# Current Status

**Active Phase:** Phase 10 — Evaluation & Monitoring

| Area | Status |
| --- | --- |
| Backend Foundation | ✅ |
| Authentication & Identity | ✅ |
| Organization Management | ✅ |
| Access & Administration | ✅ |
| Organization Synchronization | ✅ |
| Concurrency Protection | ✅ |
| Document Management | ✅ |
| Document Processing Infrastructure | ✅ |
| Processing Worker Execution | ✅ |
| AI Processing Service | ✅ |
| Query Pipeline | ✅ |
| Version-Aware Caching | ✅ |
| Cache Invalidation | ✅ |
| Query History Persistence | ✅ |
| API Rate Limiting | ⚠️ Implemented; inert — see Blocking Defects |
| Login Rate Limiting | ⚠️ Implemented; inert — see Blocking Defects |
| Authorized Retrieval Cache | ⚠️ Implemented; inert — see Blocking Defects |
| Document Reprocessing | ⚠️ Routed but unauthorized and non-functional |

## Known Backend Issues

- `document.routes.js:128` does register `POST /:documentId/versions/:versionId/reprocess` behind `authenticate`, but the handler never receives `req.user` and the service queries by `documentId` alone with no tenant filter and no `authorizeDocumentAction` call. Any authenticated user can re-dispatch processing for any document in any organization. It is also not covered by `documentUploadRateLimiter`.
- `queryCache.service.js` and `queryAccessCache.service.js` are both wired to the shared Redis module but cannot perform any Redis operation; see Blocking Defects item 0. Until that is fixed, every query performs fresh AI retrieval and fresh authorization, and `invalidateOrganizationQueryCache` after successful processing is a no-op.
- The rate limiter fails open when Redis is unavailable, so a Redis outage disables rate limiting rather than blocking traffic. This is intentional to keep the API available.
- `DocumentVersion.processingStatus` is never written anywhere. Every version stays `PENDING`, so the version-level processing state documented in `docs/DATABASE.md` does not exist in practice.
- `buildSystemPrompt()` in `query/prompt.service.js` is exported but imported nowhere, and `llm.service.js` sends a `ConverseCommand` with a single user message and no system block. The prompt-injection policy is never actually sent to Bedrock.

## Blocking Defects

Found by a full read-through audit on 2026-09-30. Every item below was verified by reading the code, not inferred.

### 0. Three Redis consumers call client methods on a connection options object

`config/redis.js` default-exports a **plain options object** (`{ host, port, username, password, tls, maxRetriesPerRequest, … }`) intended to be passed to `new Redis(options)` or to BullMQ. It is not a connected client and has no Redis methods:

```text
redis.js export type: object | has .get: undefined | has .incr: undefined | has .ttl: undefined
```

Three modules now assign `const connection = redisConnection` and then call client methods on it:

| Module | Methods called | Effect |
| --- | --- | --- |
| `query/queryCache.service.js:6` | `.get`, `.set`, `.scan`, `.del` | Every call throws `TypeError`; the cache never stores or returns anything |
| `query/queryAccessCache.service.js:5` | `.get`, `.set`, `.scan`, `.del` | Same — the authorized cache is dead |
| `authRateLimit.service.js:4` | `.ttl`, `.get`, `.incr`, `.expire`, `.del` | Every call throws; `checkLoginRateLimit` always returns `{ blocked: false }` |

This is worse than the previous `const connection = null` state, because every one of these functions wraps its Redis work in a `try/catch` that logs and continues. The `TypeError` is swallowed and the code takes its "not blocked" / "cache miss" path, so login rate limiting and both caches silently do nothing while appearing healthy in code review. Every query also logs a Redis error.

The fix is to create a shared client, for example `export const redis = config.redis.enabled ? new Redis(options) : null` in `config/redis.js`, and have BullMQ keep using the raw options object. Note that the options object also sets `maxRetriesPerRequest: 10`, which BullMQ requires to be `null` on the blocking `Worker` connection; the two consumers need different values, so they should not share a single object.

### 1. Login is normalized but registration is not

`loginUser` now looks the user up by `email.trim().toLowerCase()`, but `registerUser` still stores and checks the raw `email`.

A user who registers as `User@Email.com` stores that casing, and every subsequent login lowercases the input to `user@email.com`, which no longer matches. That account is permanently unable to log in.

`registerUser` also still performs a case-sensitive duplicate check, so `Alice@Corp.com` and `alice@corp.com` create two separate accounts for the same person. The normalization must be applied in `registerUser` as well, ideally combined with a case-insensitive unique constraint.

### 2. Document access management throws on every call

`documentAccess.service.js:298-303` checks `hasPermission(user.id, "MANAGE_ACCESS", targetUnitId, tx)`, but the `Permission` enum in `schema.prisma:83-94` contains only `INVITE_MEMBER`, `REMOVE_MEMBER`, `UPDATE_MEMBER`, `ASSIGN_ROLE`, `MOVE_MEMBER`, `CREATE_UNIT`, `UPDATE_UNIT`, `DELETE_UNIT`, `MOVE_UNIT`. `MANAGE_ACCESS` exists only on the unrelated `DocumentAccessAction` enum.

Prisma validates enum input at runtime, so `grantDocumentAccess`, `updateDocumentAccessPolicy`, and `revokeDocumentAccess` all raise `PrismaClientValidationError` and return 500. Granting, editing, and revoking document access — the core feature of the platform — is non-functional.

Compounding this: no code path ever creates a grant with an access-management permission, so even after the enum is corrected, the authority check would always return 403. A migration adding the value and a seeding/grant path are both required.

### 2. Failed processing never reaches `FAILED`

`documentProcessing.service.js:86-95`:

```text
catch (error)
  → await handleProcessingFailure(error)   // async function that only rethrows
  → await markProcessingFailed(...)        // never reached
```

`handleProcessingFailure` in `documentAI.service.js` is `async function(error){ throw error; }`, so it rethrows before `markProcessingFailed` runs. Any AI processing error leaves the document stuck in `PROCESSING` forever: never `FAILED`, never retryable, no user-visible signal. This makes `reprocessDocument` unreachable in practice, since it requires `status === "FAILED"`.

### 3. Version upload can delete the file it just committed

`documentLifecycle.service.js:790-807` — `dispatchDocumentProcessing` is called inside the same `try` as the database transaction. If dispatch throws after the transaction has committed, the `catch` block calls `deleteFileFromS3(objectKey)`, destroying the object that the newly committed `DocumentVersion` row points to.

The document is left in `QUEUED`, and `uploadDocumentVersion` requires `status === "READY"`, so no new version can be uploaded either. The file is unrecoverable.

### 4. Physical cleanup always fails with a foreign-key error

`cleanupDeletedDocument` (`documentLifecycle.service.js:587`) and `cleanupExpiredDrafts` (`:630`) both run `tx.documentVersion.deleteMany({ where: { documentId } })` before deleting the `Document` row, while `Document.currentVersionId` still references one of those versions. The relation is `onDelete: Restrict` (`schema.prisma:257`, migration `20260710095413` line 204), so every call raises `P2003` and returns 500.

`cleanupDraftUpload` gets this right by nulling `currentVersionId` first; the two cleanup paths do not. The empty `catch{}` blocks around the S3 deletes swallow their errors, hiding the real cause. Deleted documents and expired drafts can never be physically cleaned up, so S3 objects, versions, policies, and audit rows leak indefinitely.

### 5. The query response payload is inverted

`ApiResponse` takes `(statusCode, message, data)` (`utils/ApiResponse.js:4-13`), but `query.controller.js:47-61` calls `new ApiResponse(200, { query, answer, sources, ... }, "Query executed successfully.")`. The answer object lands in `message` and the string lands in `data`.

The documented response shape (`data: { query, answer, sources, evidence, usedLLM, outputGuardPassed }`) is not produced; a client reading `response.data.answer` gets `undefined`. The two 400 branches have the mirror-image problem, passing `null` as the message and the error string as data. `queryHistory.controller.js:51-61` has the same inversion. Every other controller in the codebase uses the correct order.

### 6. The security system prompt is never sent to the LLM

`prompt.service.js:1` defines a 190-line `buildSystemPrompt()` covering the trust boundary, prompt-injection resistance, no chain-of-thought, and citation rules. It is imported nowhere in the repository. `llm.service.js` builds a `ConverseCommand` whose `messages` array contains a single `role: "user"` entry and no system content.

Untrusted document text therefore reaches the model with no instruction establishing that it is data rather than instruction. The defences exist as dead code.

## Authorization Gaps

These paths resolve tenant membership but never evaluate a document access policy, so "no matching policy means no access" is enforced only inside the query pipeline.

| Path | Missing check |
| --- | --- |
| `getDocuments` (`documentLifecycle.service.js:325`) | No `VIEW` filter; returns title, description, and classification of every non-deleted document in the tenant |
| `getDocumentVersions` / `getDocumentVersionById` (`:651`, `:668`) | No `VIEW`; returns full `DocumentVersion` rows including `storageKey`, `checksum`, `storageBucket` |
| `getDocumentAccessPolicies` / `getDocumentAccessHistory` (`documentAccess.service.js:696`, `:696-728`) | No `MANAGE_ACCESS`; any tenant member can enumerate all policies and the audit trail |
| `cleanupDeletedDocument` (`documentLifecycle.service.js:552`) | No `MANAGE_ACCESS` and no ownership check; any member can permanently delete any document |
| `softDeleteDocument` / `restoreDocument` (`:512`, `:532`) | No `authorizeDocumentAction`; `restoreDocument` sets `status: "READY"` unconditionally, so restoring a `DRAFT`, `FAILED`, or `EXPIRED` document promotes it straight into the retrieval path |

`authorizeDocumentAction` also ignores `policy.scope` for `UNIT` subjects (`documentAccess.service.js:786-792`), matching only `subjectUnitId === user.unitId`. `authorizeQueryDocuments` implements both `UNIT_ONLY` and `UNIT_AND_DESCENDANTS` correctly, so a user in a descendant unit gets `QUERY` but is denied `DOWNLOAD` on the same document.

## Reliability and Consistency Issues

- **Reprocessing is a silent no-op** — `reprocessDocument` re-dispatches the same `(documentId, versionId)` pair, and `documentQueue.service.js:19` uses that pair as the BullMQ `jobId` with `removeOnComplete: 1000`. BullMQ ignores an `add()` whose id already exists, so the job is never enqueued — but the document was already set back to `QUEUED`, and the API returns 202. The document is stuck in `QUEUED` forever.
- **Cache invalidation does nothing** — `documentProcessing.service.js:83` calls `invalidateOrganizationQueryCache`, which short-circuits on the null connection described above.
- **`publishDraft` can strand a document** — the transaction commits (`status: "SUBMITTED"`, policies and audits created) and then dispatch runs outside any try/catch (`documentLifecycle.service.js:485-510`). If dispatch throws, the caller gets a 500 but the document is `SUBMITTED`, which `getDraftDocument` rejects, and no reprocess path exists for that status.
- **Concurrent publishes duplicate audit records** — `publishDraft` performs no locking and re-reads status outside the transaction. Two concurrent requests both pass `validateDocumentTransition` and both run `createInitialDocumentAccessPolicies` / `createInitialDocumentAccessAudit`, which do not perform the duplicate check that `validateDocumentAccessPolicy` does. Result: duplicate ALLOW policies and duplicate `CREATED` audit rows, violating the append-only audit invariant.
- **Revoked permissions are never revoked** — `permission.service.js:54-61` filters on `isActive: true` but never checks `revokedAt`, while `removeMember` revokes grants by setting only `revokedAt` (`organization.service.js:783-792`). A removed member who is later re-invited silently regains every prior administrative permission.
- **Privilege escalation through invitations** — `createInvitation` (`invitation.service.js:65-79`) does not validate `role` against an allow-list; it only special-cases `MEMBER`. A caller with `INVITE_MEMBER` + `ASSIGN_ROLE` can invite an address as `OWNER`, and `acceptInvitation` writes that role directly, bypassing the owner protections in `updateMemberRole`.
- **Expired invitations are never marked** — `invitation.service.js:186-193` updates status to `EXPIRED` and then throws inside the same transaction, so the update always rolls back.
- **Registration is not rate limited** — `POST /login` is now protected, but `POST /register` is not, so unlimited account creation remains possible. `express-rate-limit` is a dependency and is used nowhere.
- **The access-scope fingerprint runs on every query** — `getQueryAccessScopeFingerprint` issues a full `QUERY` policy scan plus a unit-hierarchy walk per request. Correct, but it is a per-request database cost on the hot path and should be measured.
- **Audit-log race condition** — `getDocumentAccessPolicy` (`documentHelpers.js:136`) uses the global Prisma client rather than the transaction passed by its caller, so two concurrent revocations can both read `isActive: true` and both write a `REVOKED` audit record.
- **Two divergent lifecycle transition tables** — `documentHelpers.validDocumentTransitions` omits `READY → "QUEUED"`, which `documentLifecycle.service.js:35-41` includes. The helper's copy is exported and would reject a legitimate version upload. The transition validator is also only ever applied to the `→ SUBMITTED` hop, never to the transitions that actually move a document.
- **Plain `Error` instead of `ApiError`** — `query.service.js`, `queryHistory.service.js`, `llm.service.js`, and `prompt.service.js` throw bare `Error` for missing organization, `PROMPT_REQUIRED`, `CONTEXT_REQUIRED`, and `EMPTY_LLM_RESPONSE`. `error.middleware.js` reads `err.statusCode || 500`, so all of these return 500 instead of 400/403.
- **Query history can lose a paid answer** — `saveQueryHistory` (`query.service.js:223`) runs after generation; if the insert fails the whole request 500s and the completed LLM response is discarded.
- **Multer errors surface as 500** — `upload.middleware.js` enforces a 25 MB limit, but `MulterError` has no `statusCode`, so an oversized upload returns 500 instead of 413. This is the same reason the invalid-enum bug in item 1 presents as an opaque 500.
- **`retryAfter` is dropped** — `error.middleware.js` serialises only `{ success, message }`, discarding `error.retryAfter` set by the rate limiter, and never logs the error or its stack. Every 500 in the system is currently unlogged, which is why items 2 and 4 produce no diagnostic trail.
- **Redis TLS and retry settings are wrong for the shared consumer** — `config/redis.js:11` sets `tls` regardless of `config.redis.enabled` or whether the target speaks TLS, breaking a plain local Redis. `maxRetriesPerRequest: 10` with `commandTimeout: 10000` is also invalid for BullMQ's blocking `Worker`, which requires `maxRetriesPerRequest: null`. The same settings make the fail-open rate limiter stall for up to roughly 100 seconds per request during a Redis outage rather than failing fast. The options object now needs to differ per consumer, not be shared verbatim.
- **Storage bucket is ignored** — `getDownloadUrlFromS3` uses `config.aws.bucket` and never reads the persisted `version.storageBucket`, so a bucket rotation would produce 404s.

## Dead Code

- `prompt.service.js::buildSystemPrompt` — never imported.
- `config/ai.js` (`aiClient`) — never imported; `documentAI.service.js` and `queryAI.service.js` create ad-hoc clients with inconsistent timeouts.
- `authRateLimit.service.js::getLoginRateLimitConfig` — never imported; the thresholds are hardcoded rather than read from `config.rateLimit` the way the query and upload limiters are.
- `queryAccessCache.service.js::buildQueryAccessScopeHash` — exported but never imported. `documentAccess.service.js::getQueryAccessScopeFingerprint` builds the hash with its own private `buildAccessScopeHash`, so this is a duplicate of live logic.
- `context.service.js::buildContext` — never imported.
- `expireDocumentDrafts` — no route triggers bulk draft expiry.
- `config/bullmq.js` — exports a `connection` that is always `null`; the commented-out import in `queryCache.service.js:4` is where the disabled cache originated.
- `documentQueue.service.js::getProcessingJOb`, `removeProcessingJob` — never called.
- `health.routes.js` imports `auth` and never uses it. `documentLifecycle.service.js` imports `getDocument` and never uses it.
- `documentHelpers.js` duplicates the expiry window, classification list, transition table, and draft-cleanup logic already present in `documentLifecycle.service.js`.

---

# Recent Changes (2026-09-30)

## Processing Worker Execution

The BullMQ worker existed as a file but was never instantiated, so queued document jobs were accepted by the queue and never consumed. Documents stayed in `QUEUED` indefinitely.

### New File

- `workers/document.worker.js` — creates a `Worker` on the `document-processing` queue with `concurrency: 1`, reusing the shared connection from `config/redis.js`. The handler calls `processDocument({ documentId, versionId })` from `documentProcessing.service.js` and logs `ready`, `completed`, `failed`, and `error` events. The worker is only created when `config.redis.enabled` is true.

### Wiring

- `server.js` imports `./src/workers/document.worker.js` at startup, alongside `initializeDocumentQueue`. Producer and consumer now both run inside the API process; a multi-instance deployment would need a dedicated worker process.

## Queue Job ID Fix

- `documentQueue.service.js` — the job id separator changed from `:` to `-`. BullMQ treats `:` as its custom-id separator, so `${documentId}:${versionId}` was parsed as a custom job id rather than the literal string, breaking deduplication when the same version was dispatched again. Job ids are now `${documentId}-${versionId}`.

## Document Reprocessing

Failed documents previously had no recovery path other than uploading a new version.

- `documentProcessing.service.js` — new `reprocessDocument({ documentId, versionId })`. It loads the document, throws 404 if missing, throws 400 unless `status === "FAILED"`, throws 400 unless `versionId` is the current version, sets the document back to `QUEUED`, and re-dispatches through the normal dispatcher, so it respects `REDIS_ENABLED` and falls back to direct processing.
- `document.controllers.js` — new `reprocessDocument` handler returning 202 with "Document reprocessing queued successfully."
- Registered at `POST /:documentId/versions/:versionId/reprocess` in `document.routes.js`. See Known Backend Issues: the route passes no user and the service performs no authorization or tenant check.

## `processingError` Field Removal

- `documentProcessing.service.js` — `updateProcessingStatus`, `markProcessingReady`, and `markProcessingFailed` no longer write a `processingError` column, and the unused `errorMessage` parameter was dropped from `updateProcessingStatus`.
- `documentLifecycle.service.js` — `uploadDocumentVersion` no longer sets `processingError: null` when moving a document to `QUEUED`.

The field does not exist in `schema.prisma`, so each of those writes would have raised a Prisma unknown-argument error and pushed a healthy document into `FAILED`. Failure detail is currently only visible in logs; a persisted failure reason is still needed for the UI.

## Missing Import Fix

- `documentLifecycle.service.js` — `getDocumentDownloadUrl` called `authorizeDocumentAction(user, documentId, "DOWNLOAD")` without importing it, raising a `ReferenceError` on every download request. The import from `documentAccess.service.js` is now present, so `DOWNLOAD` authorization is actually enforced before a presigned URL is issued.

## AI Processing Payload

- `documentAI.service.js` — the processing payload now includes `file_name: version.originalFileName` alongside `document_id`, `version_id`, `organization_id`, and `file_url`. The AI service previously derived the file extension from the presigned URL path, which broke whenever the S3 key did not end in a recognisable extension.
- `ai-service/app/schemas/processing.py` — `ProcessDocumentRequest` requires `file_name` (`min_length=1`); `DocumentProcessingService` takes the suffix from it instead of parsing the URL.
- `ai-service/app/services/extractors/base.py` — `BaseExtractor` gained `log_start`, `log_success`, and `log_failure` helpers so extraction timing and failures are logged consistently across formats.
- `document.controllers.js` — `publishDraft` and `getDocumentDownloadUrl` log caught errors before rethrowing.

## Authorized Retrieval Cache

The raw-candidate cache is shared across all users of a tenant, so it cannot store an authorized result set — that would leak one user's permissions to another. This change adds a second, per-access-scope cache for the authorized result.

### New Files

- `services/query/queryAccessCache.service.js` — tenant-scoped cache for the **authorized** candidate list. Keys are `rag:authorized-retrieval:{organizationId}:{accessScopeHash}:{topK}:{sha256(query)}` with a 300-second TTL, plus `invalidateOrganizationAuthorizedQueryCache(organizationId)` using `SCAN` + `DEL`.

### Access Scope Fingerprint

- `documentAccess.service.js` — new `getQueryAccessScopeFingerprint(user)`. It loads every `QUERY` policy in the organization, filters to those matching the user (ORGANIZATION, UNIT with `UNIT_ONLY` or `UNIT_AND_DESCENDANTS` against the resolved unit hierarchy, ROLE, USER), applies `isDocumentAccessPolicyActive`, sorts by policy id, and hashes the result together with `organizationId`, `unitId`, `role`, and the unit hierarchy.

Two users with different effective access therefore never share a cache entry, and any change to a matching policy changes the hash and misses the cache.

### Invalidation

- `grantDocumentAccess`, `updateDocumentAccessPolicy`, and `revokeDocumentAccess` now invalidate the tenant's authorized-retrieval cache after their transaction commits, via a `.then()` chained onto `prisma.$transaction`.

Document version changes are not handled by invalidation. Instead the cache is re-validated on read, which is stronger: see below.

### Query Pipeline Refactor

`retrieveAuthorizedCandidates` was restructured into three steps:

- `validateCurrentCandidates(organizationId, candidates)` — filters candidates against a direct `prisma.document.findMany` for `status: "READY"`, `isDeleted: false`, and a non-null `currentVersionId` within the tenant. This runs on every cache read, so a cached authorized set cannot outlive a version change.
- `authorizeCandidates(user, candidates)` — calls `authorizeQueryDocuments` and filters to the current version, replacing the previous inline logic and the duplicate stale-candidate refresh branch.
- The main function now reads the raw cache, computes the access fingerprint, reads the authorized cache, and only falls back to `authorizeCandidates` + `setCachedAuthorizedQuery` on a miss.

Both the raw cache and the authorized cache are always written with the candidate list produced by that specific request.

## Login Rate Limiting

### New Files

- `services/authRateLimit.service.js` — fixed-window counters in Redis: 5 failed attempts per normalized email and 20 per IP within a 15-minute window. Exposes `checkLoginRateLimit`, `recordFailedLogin`, `clearEmailLoginFailures`, and `getLoginRateLimitConfig`. Fails open on any Redis error so authentication stays available.
- `middleware/loginRateLimit.middleware.js` — `loginRateLimiter` reads the email from the body and the IP from `req.ip`, calls the check, and rejects with a 429 carrying a `Retry-After` header. Missing email still receives IP-based protection.

### Wiring

- `auth.routes.js` — `POST /login` now runs `loginRateLimiter`. `POST /register` is still unlimited.
- `auth.controller.js` — `login` forwards `req.ip` to the service.
- `auth.services.js` — `loginUser` normalizes the email to `email.trim().toLowerCase()` before lookup, records a failed attempt for both unknown-email and wrong-password cases using an identical 401 message, and clears the email counter on success. The IP counter is deliberately not cleared on success. An inactive account returns 403 without counting as a failure.

### Banner Comments Removed

Decorative `/* --- */` section banners were removed from `routes/document.routes.js` and `services/query/query.service.js`. Explanatory comments were preserved; only the separator rules and numbered titles were dropped.

---

# Recent Changes (2026-09-28)

## API Rate Limiting

Added a Redis-backed token bucket in front of the two expensive endpoints, so a single user cannot exhaust LLM or processing capacity.

### New Files

- `config/redis.js` — single shared Redis connection object (`host`, `port`, `username`, `password`, TLS with `rejectUnauthorized: false`, `maxRetriesPerRequest: 3`, `enableReadyCheck`, `lazyConnect: false`, 10s connect timeout, 5s command timeout, capped exponential retry, reconnect on `ECONNRESET` / `ETIMEDOUT` / `ECONNREFUSED` / `EHOSTUNREACH`). It is created only when `config.redis.enabled` is true.
- `middleware/rateLimit.middleware.js` — token bucket implemented as an atomic Lua script, registered with `redis.defineCommand("consumeToken")`. Exports `queryRateLimiter` and `documentUploadRateLimiter`.

### Behavior

- Buckets are keyed per user: `rate-limit:{prefix}:user:{userId}`.
- Tokens and timestamp are stored in a Redis hash; the bucket key expires after `capacity / refillRate * 2` seconds so idle buckets are removed.
- A rejected request throws `ApiError` with status 429 and a `retryAfter` value in seconds.
- `refillRate` is configured per interval and divided by `refillIntervalSeconds` to obtain a per-second rate.
- Missing `req.user.id` throws 401.
- The limiter is a no-op when `REDIS_ENABLED` is not `true`, and it **fails open** on any Redis error so a Redis outage does not take down the API.

### Route Wiring

- `query.routes.js` — `POST /api/v1/query` now runs `authenticate` then `queryRateLimiter`.
- `document.routes.js` — `POST /drafts/:documentId/upload` and `POST /:documentId/versions` now run `authenticate`, `documentUploadRateLimiter`, then `upload.single("file")`. The limiter runs before Multer so rejected requests do not consume upload bandwidth or disk.

### Redis Connection Consolidation

- `config/bullmq.js` no longer builds its own connection object; it imports `redisConnection` from `config/redis.js` and reuses it for the `document-processing` queue. Retry, TLS, and timeout behavior is now identical between the queue and the rate limiter.

### New Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `QUERY_RATE_LIMIT_CAPACITY` | `30` | Query bucket size |
| `QUERY_RATE_LIMIT_REFILL_RATE` | `0.5` | Query tokens added per interval |
| `QUERY_RATE_LIMIT_REFILL_INTERVAL` | `1` | Query refill interval in seconds |
| `DOCUMENT_UPLOAD_RATE_LIMIT_CAPACITY` | `10` | Upload bucket size |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_RATE` | `1` | Upload tokens added per interval |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_INTERVAL` | `60` | Upload refill interval in seconds |

Redis variables are now host-based: `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`.

---

# Recent Changes (2026-09-27)

## Query History Persistence

Every executed query is now persisted so answers can be listed per user later, and so retrieval quality can be evaluated offline. See `docs/DATABASE.md` — Query History for the schema.

### Write Path

- `query.service.js` — new `saveQueryHistory` helper. It writes a record on both return paths: the evidence-insufficient fallback and the generated-answer path.
- The stored record keeps the guarded answer, not the raw LLM output.
- History is written after the output guardrail runs, so blocked output is recorded with `outputGuardPassed: false`.
- `organizationId` is resolved from `user.unit.organizationId`, the same source used for authorization and cache scoping. A missing organization or user id throws instead of writing a partial record.
- The insufficient-evidence response now also returns `outputGuardPassed: false`, making the response shape consistent across both paths.

### Read Path

- `queryHistory.service.js` — `getQueryHistory(user, limit, offset)`, scoped to the caller's organization and user, ordered by `createdAt` descending.
- `queryHistory.controller.js` — `getUserQueryHistory` with `limit` (integer, 1–100, default 20) and `offset` (non-negative integer, default 0) validation returning HTTP 400 on invalid input.
- `queryHistory.routes.js` — mounted at `/query/history` behind `authenticate`.
- The response does not expose the `organizationId` or `userId` columns.

### Query History API

```text
GET /api/v1/query/history?limit=20&offset=0
```

Response data:

```text
{
    history: [
        {
            id,
            query,
            answer,
            sources,
            evidence,
            usedLLM,
            outputGuardPassed,
            createdAt
        }
    ],
    limit,
    offset
}
```

### Other Backend Changes

- `bullmq.js` — Redis connection now sets `enableReadyCheck` and `lazyConnect: false`, and logs `connect`, `ready`, `error`, and `close` events.
- `query.routes.js` — imports `authenticate` as a default export, matching the middleware module.
- `documentAccess.service.js` — added the file header comment; no behavior change.
- `query.service.js` — reformatted to the project's spacing conventions; no behavior change beyond history persistence.
- `axios` added to backend dependencies.

## Version-Aware Query Caching & Cache Invalidation

Implemented version-aware caching to prevent stale retrieval results after document updates and cache invalidation after successful document processing.

### Backend Changes

- `queryCache.service.js` — Tenant-scoped Redis retrieval cache with SHA-256 query keys, 300-second TTL, cached candidate arrays, and organization-level invalidation.
- `documentProcessing.service.js` — Version-safe processing status updates using `documentId`, `currentVersionId`, and current status; successful processing invalidates the organization's retrieval cache.
- `query.service.js` — Validates cached candidates against `currentVersionId`, re-fetches stale cache results from the AI service, and filters candidates to the current version.
- `documentAccess.service.js` — `authorizeQueryDocuments` filters to READY documents with a current version and returns `{ documentId, currentVersionId }`.

### Behavior

- Cached candidates are checked against the current document version.
- Stale cached candidates trigger fresh AI retrieval.
- Candidates from superseded versions are excluded before reranking and LLM generation.
- Old document versions remain stored in Qdrant for historical/version-aware functionality.
- Successful document processing invalidates tenant retrieval caches.

---

# Recent Changes (2026-09-20)

## Multi-Tenant Organization Isolation

Added `organization_id` throughout processing and retrieval flows.

### Backend

- `documentAI.service.js` includes `organization_id` in processing payloads.
- `queryAI.service.js` forwards `organizationId` to the AI service.
- `queryCache.service.js` includes organization ID in cache keys.
- `query.service.js` obtains organization ID from `user.unit.organizationId`.

### AI Service

- Processing and retrieval schemas require `organization_id`.
- Qdrant has an `organization_id` payload index.
- Every indexed point stores `organization_id`.
- Qdrant search filters by `organization_id`.
- Retrieval and document processing propagate organization ID.

### Bug Fixes

- Fixed circular self-import in `app/services/extractors/base.py`.
- Added missing `ApiResponse` model.
- Removed the conflicting legacy `app/schemas/retrieval/` package.

---

# Local Setup

```bash
cd backend
npm install
npx prisma migrate dev
npm run dev
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port |
| `NODE_ENV` | Application environment |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token expiry |
| `AWS_REGION` | Amazon S3 region |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_S3_BUCKET` | Document storage bucket |
| `REDIS_ENABLED` | Enable or disable Redis |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port (default `6379`) |
| `REDIS_USERNAME` | Redis username |
| `REDIS_PASSWORD` | Redis password |
| `AI_SERVICE_URL` | FastAPI AI service endpoint |
| `LLM_PROVIDER` | LLM provider |
| `LLM_MODEL_ID` | Bedrock model ID |
| `LLM_REGION` | Bedrock AWS region |
| `LLM_MAX_TOKENS` | Maximum LLM response tokens |
| `LLM_TEMPERATURE` | LLM temperature |
| `QUERY_RATE_LIMIT_*` | Query token bucket settings |
| `DOCUMENT_UPLOAD_RATE_LIMIT_*` | Upload token bucket settings |

API base path:

```text
/api/v1
```

---

# Completed Phases

## Phase 1 — Backend Foundation ✅

Implemented:

- Express.js REST API
- Versioned routing
- PostgreSQL + Prisma ORM
- Shared configuration
- Global error handling
- Shared API response utilities
- Environment configuration

---

## Phase 2 — Authentication & Identity ✅

Implemented:

- User registration
- User login
- JWT authentication
- Password hashing
- Current-user endpoint
- Authentication middleware
- `req.user` context resolution

Authentication flow:

```text
JWT
 ↓
Verify Token
 ↓
Load Active User
 ↓
Load Organization Unit
 ↓
Attach req.user
```

---

## Phase 3 — Organization Management ✅

Implemented:

- Organization creation
- Automatic COMPANY root creation
- Hierarchical organization structure
- Tenant isolation
- Organization unit CRUD
- Hierarchy validation
- Protected deletion rules

Supported hierarchy:

```text
COMPANY
└── DEPARTMENT
    └── TEAM
        └── GROUP
```

---

## Phase 4 — Access & Administration ✅

### Permission System

Implemented:

- Scoped permissions
- Delegated authority
- Permission history
- Permission revocation
- Transaction-safe validation

### Invitation Management

Implemented:

- Invitation creation
- Secure invitation tokens
- Invitation acceptance
- Expiration handling
- Revocation
- Capacity validation

Email delivery is planned for a later phase.

### Member Management

Implemented:

- Member listing
- Role updates
- Unit movement
- Member removal
- Owner protection
- Permission cleanup

### Organization Capacity

Implemented:

- Parent capacity enforcement
- Allocation tracking
- Over-allocation prevention

### Organization Reorganization

Implemented:

- Unit movement
- Subtree movement
- Circular-reference protection
- Capacity validation

### Synchronization

Implemented:

- Organization revision tracking
- Stale-state detection
- Multi-user synchronization

### Concurrency Protection

Implemented:

- Serializable Prisma transactions
- Automatic retry for Prisma `P2034`
- Transaction-safe organization mutations

---

# Phase 5 — Document Management ✅

Database migration:

```text
20260710095413_add_document_management
```

Document models, lifecycle transitions, and the security model are documented in [`docs/DATABASE.md`](DATABASE.md). See the Document Management, Document Lifecycle, and Document Access & Authorization sections there.

### Implemented Features

#### Draft Management

- Draft creation
- Draft updates
- Draft expiration (24-hour staging window, 403 on expired)
- Tenant-isolated draft listing
- Draft cleanup

#### File Storage

- Amazon S3 uploads
- SHA-256 checksum generation
- File validation
- Transaction-safe rollback
- Secure deletion

#### Publication

- Draft publication
- Initial access policy creation
- Initial audit record creation
- Immutable version creation

#### Version Management

- Version uploads
- Version history
- Current version tracking
- Presigned download URLs
- Old versions retained for historical use

#### Access Control

Access control subjects, actions, DENY precedence, temporary access, and policy mutations are documented in [`docs/DATABASE.md`](DATABASE.md) — Document Access & Authorization.

Implemented:

- ALLOW / DENY policies
- DENY precedence
- Temporary access (max 7 days)
- Policy updates (action immutable when editing)
- Policy history
- Append-only audit log
- `authorizeDocumentAction`
- `authorizeQueryDocuments`
- Current-version validation for query candidates
- `getActiveDocument` rejects EXPIRED documents (404)

---

## Query Pipeline

Entry point:

```text
POST /api/v1/query
```

Pipeline:

```text
Frontend
 ↓
JWT Authentication
 ↓
Rate Limit (Redis token bucket)
 ↓
Organization Context
 ↓
Redis Retrieval Cache
 ↓
AI Service Retrieval
 ↓
PostgreSQL Document Authorization
 ↓
Current Version Validation
 ↓
Reranking
 ↓
Evidence Sufficiency
 ↓
Safe Context
 ↓
RAG Prompt
 ↓
Amazon Bedrock / Nova Pro
 ↓
Citation Validation
 ↓
Output Guardrail
 ↓
Answer + Sources
 ↓
Query History Persistence
```

### Service Files

| Service | Key Function | Purpose |
| --- | --- | --- |
| `query.controller.js` | `queryDocuments` | Query endpoint handler |
| `query.service.js` | `retrieveAuthorizedCandidates` | Query orchestration |
| `queryAI.service.js` | `retrieveFromAI` | AI retrieval call |
| `queryCache.service.js` | `getCachedQuery`, `setCachedQuery` | Tenant-scoped Redis cache |
| `reranking.service.js` | `rerankCandidates` | Score-based reranking |
| `contextGuard.service.js` | `buildSafeContext` | Context sanitization and limits |
| `prompt.service.js` | `buildRAGPrompt` | Secure RAG prompt |
| `evidence.service.js` | `checkEvidenceSufficiency` | Evidence validation |
| `answer.service.js` | `generateQueryAnswer` | Answer generation |
| `answerValidation.service.js` | `validateGeneratedAnswer` | Citation validation |
| `outputGuardrail.service.js` | `validateGeneratedAnswer` | Output safety filtering |
| `llm.service.js` | `generateAnswer` | Bedrock Converse API |
| `queryHistory.service.js` | `getQueryHistory` | Per-user query history read model |

### Query API

```text
POST /api/v1/query
```

Requires JWT authentication. `organization_id` is derived from the authenticated user's organization context and is not accepted from the request body.

Request fields:

| Field | Type | Required | Default | Constraints |
| --- | --- | --- | --- | --- |
| `query` | string | Yes | — | Non-empty after trimming |
| `topK` | integer | No | 5 | 1–20 |

Response fields:

| Field | Type | Description |
| --- | --- | --- |
| `query` | string | Normalized user query |
| `answer` | string | Grounded LLM response or evidence fallback |
| `sources` | array | Cited document chunks |
| `evidence` | object | Evidence sufficiency result |
| `usedLLM` | boolean | Whether the LLM was invoked |
| `outputGuardPassed` | boolean | Output guard result |

Every response is also written to `QueryHistory` after the output guardrail runs.

> **Known defect:** this is the intended shape, not the shape currently returned. `query.controller.js` and `queryHistory.controller.js` pass the `ApiResponse` arguments in the wrong order, so the payload above is emitted under `message` and `data` becomes a string. See Blocking Defects item 5.

Evidence reasons:

```text
SUFFICIENT_EVIDENCE
NO_AUTHORIZED_EVIDENCE
NO_USABLE_EVIDENCE
LOW_RELEVANCE
```

Error responses include validation failures and authentication failures.

---

# Authorization Flow

Policy resolution rules are documented in [`docs/DATABASE.md`](DATABASE.md) — Document Access & Authorization. Key points: DENY always wins; expired or inactive policies are rejected; `isDocumentAccessPolicyActive` enforces `isActive`, `validFrom`, and `validUntil` at authorization time.

---

# Processing Pipeline

Document publication triggers processing:

```text
Document Publication
 ↓
Database Transaction
 ↓
Processing Dispatcher
 ↓
BullMQ or Direct Processing
 ↓
Document Worker
 ↓
Document Processing
 ↓
FastAPI AI Service
 ↓
Document Status READY / FAILED
```

Processing payload contains:

```text
document_id
version_id
organization_id
file_url
file_name
```

`file_name` is the stored original filename and is what the AI service uses to determine the file type.

The backend owns orchestration, authorization, lifecycle management, and processing state.

The AI service owns:

- Content extraction
- OCR support (planned)
- Chunk generation
- Embedding generation
- Vector indexing

---

# Document API Endpoints

All routes require authentication.

```text
# Drafts
POST    /drafts
POST    /drafts/:documentId/upload
DELETE  /drafts/:documentId/upload
POST    /drafts/:documentId/publish
POST    /cleanup/expired-drafts

# Documents
GET     /
GET     /:documentId
PATCH   /:documentId
DELETE  /:documentId
PATCH   /:documentId/restore
DELETE  /:documentId/cleanup

# Versions
GET     /:documentId/versions
GET     /:documentId/versions/:versionId
POST    /:documentId/versions
GET     /:documentId/download
GET     /:documentId/versions/:versionId/download

# Access
POST    /:documentId/access
POST    /:documentId/access/temporary
GET     /:documentId/access
GET     /:documentId/access/history
GET     /access/:policyId
PATCH   /access/:policyId
DELETE  /access/:policyId
```

---

# Platform API

## Health

```text
GET /api/v1/health
```

## Authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

`POST /api/v1/auth/login` is protected by `loginRateLimiter` (5 failed attempts per email, 20 per IP, 15-minute window). The counter increments on unknown-email and wrong-password responses; a successful login clears the email counter but not the IP counter. `POST /api/v1/auth/register` is not rate limited.

## Organization

```text
GET    /api/v1/organization
POST   /api/v1/organization
PATCH  /api/v1/organization

GET    /api/v1/organization/revision

GET    /api/v1/organization/units
POST   /api/v1/organization/units
PATCH  /api/v1/organization/units/:unitId
PATCH  /api/v1/organization/units/:unitId/move
PATCH  /api/v1/organization/units/:unitId/capacity
DELETE /api/v1/organization/units/:unitId

GET    /api/v1/organization/members
PATCH  /api/v1/organization/members/:memberId/role
PATCH  /api/v1/organization/members/:memberId/unit
DELETE /api/v1/organization/members/:memberId

GET    /api/v1/organization/units/:unitId/capacity
```

## Permissions

```text
GET   /api/v1/permissions/me
GET   /api/v1/permissions/members/:memberId
POST  /api/v1/permissions
PATCH /api/v1/permissions/:permissionGrantId/revoke
```

## Invitations

```text
GET   /api/v1/invitations
POST  /api/v1/invitations
GET   /api/v1/invitations/received
PATCH /api/v1/invitations/accept/:token
PATCH /api/v1/invitations/:invitationId/revoke
```

## Query

```text
POST /api/v1/query
GET  /api/v1/query/history
```

`GET /api/v1/query/history` requires JWT authentication and returns only the calling user's entries within their own organization, newest first. Query parameters are `limit` (1–100, default 20) and `offset` (default 0).

---

# Phase Overview

## Phase 6 — Document Processing ✅

### Backend Infrastructure

- Redis queue integration
- BullMQ queue producer (`documentQueue.service.js`)
- BullMQ worker (`workers/document.worker.js`, concurrency 1, started by `server.js`)
- Processing dispatcher
- Processing retries — 3 attempts with exponential backoff, configured as queue default job options
- Dead-letter queue — todo

### Backend Processing Services

- `documentLifecycle.service.js`
- `documentProcessingDispatcher.service.js`
- `documentProcessing.service.js`
- `documentQueue.service.js`
- `documentAI.service.js`
- `documentHelpers.js`
- `documentAccess.service.js`

### Failure Handling

- Processing failure sets the document to `FAILED` scoped to the current version — currently blocked by the `handleProcessingFailure` rethrow described in Blocking Defects
- Failed processing can be re-queued through `reprocessDocument` — route exists, but authorization is missing and the BullMQ `jobId` makes the re-dispatch a no-op
- Failure reason is logged only; there is no persisted `processingError` column, and `DocumentVersion.processingStatus` is never written

### AI Service

- FastAPI processing service
- Document extraction
- OCR support — planned
- Chunk generation
- Embedding generation
- Qdrant indexing
- Multi-tenant organization isolation
- Processing response handling

---

## Phase 7 — Retrieval Infrastructure ✅

### Vector Indexing

- Qdrant integration
- Version-aware indexing
- Organization-aware payload indexing
- Permission-aware retrieval through backend authorization
- Old document versions retained in Qdrant
- Document re-indexing semantics — pending
- Metadata synchronization — not yet needed

### Retrieval

- Vector similarity search
- Organization filtering
- Permission-aware retrieval
- Score-based reranking
- Hybrid retrieval — planned
- Metadata filtering — planned

---

## Phase 8 — Retrieval-Augmented Generation ✅

Implemented:

- Vector retrieval with candidate multiplier
- Organization-aware retrieval
- Tenant-scoped Redis query cache
- Document authorization before LLM use
- Current-version validation
- Score-based reranking
- Evidence sufficiency checks
- Safe context reconstruction
- Secure RAG prompt construction
- Bedrock Converse integration with `amazon.nova-pro-v1:0`
- Source citation validation
- Output guardrail filtering
- Evidence-based LLM fallback

Planned:

- Streaming responses
- Hybrid retrieval (BM25 + vector)
- Semantic reranking (cross-encoder)

---

## Phase 9 — Reliability & Performance ✅

Implemented:

- Version-aware caching
- Redis caching
- Cache invalidation
- Background cleanup
- Queue optimization
- Retrieval optimization
- Redis-backed API rate limiting (query and document upload token buckets)

### Version-Aware Caching

- Redis keys use organization ID, topK, and SHA-256 query hash.
- Cached candidates are validated against the document's current version.
- Stale candidates trigger fresh AI retrieval.
- Candidates from superseded versions are excluded.
- Authorized candidates are cached separately, keyed by an access-scope fingerprint so two users with different permissions never share an entry.
- Access policy changes invalidate the tenant's authorized cache; version changes are handled by re-validating on read instead.
- Successful document processing invalidates tenant retrieval cache.
- Processing status updates are scoped to the expected document version.

> All of the above is currently inert at runtime. See Blocking Defects item 0.

---

## Phase 10 — Evaluation & Monitoring ⏳

Planned:

- Retrieval evaluation
- Generation evaluation
- Queue monitoring
- Processing latency
- AI service monitoring
- Cost monitoring
- Security monitoring

Query history persistence is now in place, which is the prerequisite for retrieval and generation evaluation. Analytics endpoints and a history UI are not implemented yet.

---

## Phase 11 — Deployment ⏳

Planned:

- Docker
- Production deployment
- Logging
- Observability
- Health monitoring
- Scaling

---

# Backend Structure

```text
backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── server.js
└── src/
    ├── app.js
    ├── config/
    │   ├── ai.js
    │   ├── bullmq.js
    │   ├── config.js
    │   ├── prisma.js
    │   ├── redis.js
    │   └── s3.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── document.controllers.js
    │   ├── health.controller.js
    │   ├── invitation.controller.js
    │   ├── organization.controller.js
    │   ├── permission.controller.js
    │   ├── query.controller.js
    │   └── query/
    │       └── queryHistory.controller.js
    ├── middleware/
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   ├── loginRateLimit.middleware.js
    │   ├── notFound.middleware.js
    │   ├── rateLimit.middleware.js
    │   └── upload.middleware.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── document.routes.js
    │   ├── health.routes.js
    │   ├── index.js
    │   ├── invitation.routes.js
    │   ├── organization.routes.js
    │   ├── permission.routes.js
    │   ├── query.routes.js
    │   └── queryHistory.routes.js
    ├── services/
    │   ├── auth.service.js
    │   ├── authRateLimit.service.js
    │   ├── document.service.js
    │   ├── invitation.service.js
    │   ├── organization.service.js
    │   ├── permission.service.js
    │   ├── s3.service.js
    │   ├── document/
    │   │   ├── documentAccess.service.js
    │   │   ├── documentAI.service.js
    │   │   ├── documentHelpers.js
    │   │   ├── documentLifecycle.service.js
    │   │   ├── documentProcessing.service.js
    │   │   ├── documentProcessingDispatcher.service.js
    │   │   └── documentQueue.service.js
    │   └── query/
    │       ├── answer.service.js
    │       ├── answerValidation.service.js
    │       ├── context.service.js
    │       ├── contextGuard.service.js
    │       ├── evidence.service.js
    │       ├── llm.service.js
    │       ├── outputGuardrail.service.js
    │       ├── prompt.service.js
    │       ├── query.service.js
    │       ├── queryAI.service.js
    │       ├── queryAccessCache.service.js
    │       ├── queryCache.service.js
    │       ├── queryHistory.service.js
    │       └── reranking.service.js
    ├── workers/
    │   └── document.worker.js
    └── utils/
    	├── ApiError.js
    │   ├── ApiResponse.js
    │   ├── asyncHandler.js
    │   ├── fileValidation.js
    │   ├── jwt.js
    │   ├── password.js
    │   └── serializeBigInt.js
```

---

# Migrations

See [`docs/DATABASE.md`](DATABASE.md) — Database Status for the complete migration list.
