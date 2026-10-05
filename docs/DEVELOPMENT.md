# Enterprise RAG Backend Development Log

Implementation progress for the Enterprise RAG Platform backend.

Database design: `docs/DATABASE.md`

Every issue recorded here was verified by reading the code. Where a claim was additionally
exercised against the live database, Redis, or S3, that is recorded at the point of the claim.
Where a claim could not be exercised at all, that is stated there too.

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
| API Rate Limiting | ✅ |
| Login Rate Limiting | ✅ |
| Authorized Retrieval Cache | ✅ |
| Document Reprocessing | ✅ |

The remaining work is catalogued in **Blocking Defects**, **Authorization Gaps**,
**Reliability and Consistency Issues**, and **Dead Code** below. Items not appearing in any
of those four sections are either resolved or tracked as planned phase scope.

## Known Backend Issues

Issues that do not belong to a single defect, gap, or dead-code entry.

- The rate limiter **fails open** when Redis is unavailable, so a Redis outage disables rate
  limiting rather than blocking traffic. Intentional, to keep the API available.
- `validateTemporaryAccess` (`documentAccess.service.js:381-385`) throws `new ApiError(400, )`
  with no message argument, so a temporary grant longer than the 7-day maximum
  (`MAX_TEMPORARY_ACCESS_DAYS`, `:19`) returns a 400 with an empty message. The template literal
  naming the limit was lost in the 2026-10-04 reformat.
- `markProcessingFailed` accepts an `error` argument and discards it. There is no
  `processingError` column in the schema, so failure detail is log-only and a persisted
  reason is still needed for the UI.

---

# Blocking Defects

Found by a full read-through audit on 2026-09-30 and re-verified against the current code on
2026-10-04. Defects resolved since the audit are recorded under Recent Changes with their dates.

### 1. The query response payload is inverted

`ApiResponse` takes `(statusCode, message, data)` (`utils/ApiResponse.js:4-13`), but
`query.controller.js:47-61` calls
`new ApiResponse(200, { query, answer, sources, ... }, "Query executed successfully.")`. The
answer object lands in `message` and the string lands in `data`.

The documented response shape (`data: { query, answer, sources, evidence, usedLLM,
outputGuardPassed }`) is not produced; a client reading `response.data.answer` gets
`undefined`. The two 400 branches have the mirror-image problem, passing `null` as the message
and the error string as data. `queryHistory.controller.js:51-61` has the same inversion. Every
other controller in the codebase uses the correct order.

### 2. The security system prompt is never sent to the LLM

`prompt.service.js:1` defines a 190-line `buildSystemPrompt()` covering the trust boundary,
prompt-injection resistance, no chain-of-thought, and citation rules. It is imported nowhere in
the repository. `llm.service.js` builds a `ConverseCommand` whose `messages` array contains a
single `role: "user"` entry and no system content.

Untrusted document text therefore reaches the model with no instruction establishing that it is
data rather than instruction. The defences exist as dead code.

---

## Authorization Gaps

The document lifecycle, access-policy, and version read/write paths all evaluate a policy or an
ownership check. The residual gaps are narrower:

| Path | Residual gap |
| --- | --- |
| `restoreDocument` (`documentLifecycle.service.js:462`) | Ownership is enforced and a `currentVersionId` must exist, but the status is still set to `READY` unconditionally, so restoring a `FAILED` or `EXPIRED` document promotes it straight into the retrieval path |
| `getDocuments` (`documentLifecycle.service.js:295`) | Correct but expensive: one `authorizeDocumentAction` call per non-draft document, each issuing a policy query plus a full unit-hierarchy walk. Listing a tenant with many documents is N+1 authorization queries on a user-facing endpoint |

All `MANAGE_ACCESS` mutations (`documentAccess.service.js`, `documentLifecycle.service.js`,
`documentProcessing.service.js`) are now satisfiable by an `OWNER` or `ADMIN` as well as the
uploader, so this is no longer a gap. See Recent Changes 2026-10-05.

Draft-scoped paths (`updateDocumentDraft`, `uploadDraft`, `deleteDraftUpload`, `publishDraft`,
`getDocumentById`, `getDocumentVersions`, `getDocumentVersionById`) use `authorizeDraftOwner`,
which requires `document.uploadedById === user.id`. There is no delegated draft authority — an
uploader cannot hand a draft to a colleague before publishing.

`authorizeDocumentAction` honours `policy.scope` for `UNIT` subjects through
`getUserUnitHierarchy`, so `UNIT_AND_DESCENDANTS` grants match a descendant unit exactly as
`authorizeQueryDocuments` does. It also scopes the policy query to `user.unit.organizationId`
and rejects users with no unit before evaluating any policy.

## Reliability and Consistency Issues

- **`publishDraft` can strand a document** — the transaction commits (`status: "SUBMITTED"`,
  policies and audits created) and then dispatch runs outside any try/catch
  (`documentLifecycle.service.js:438-452`). If dispatch throws, the caller gets a 500 but the
  document is `SUBMITTED`, which `getDraftDocument` rejects, and no reprocess path exists for
  that status. This is the same shape `uploadDocumentVersion` had before its 2026-10-05 fix.
- **Concurrent publishes duplicate audit records** — `publishDraft` performs no locking and
  re-reads status outside the transaction. Two concurrent requests both pass
  `validateDocumentTransition` and both run `createInitialDocumentAccessPolicies` /
  `createInitialDocumentAccessAudit`, which do not perform the duplicate check that
  `validateDocumentAccessPolicy` does. Result: duplicate ALLOW policies and duplicate `CREATED`
  audit rows, violating the append-only audit invariant.
- **Duplicate dispatches are no longer deduplicated** — `documentQueue.service.js:19` appends
  `Date.now()` to the BullMQ `jobId` so a re-dispatch is accepted instead of being silently
  dropped, but that also removes deduplication for a retried or double-clicked dispatch, which
  now queues a second identical job.
- **Registration is not rate limited** — `POST /login` is protected, but `POST /register` is not,
  so unlimited account creation remains possible. `express-rate-limit` is a dependency and is
  used nowhere.
- **Reprocess route is not rate limited** — `POST /:documentId/versions/:versionId/reprocess` is
  authorized and re-dispatchable but is not covered by `documentUploadRateLimiter`, unlike the
  two other dispatching routes.
- **The access-scope fingerprint runs on every query** — `getQueryAccessScopeFingerprint` issues
  a full `QUERY` policy scan plus a unit-hierarchy walk per request. Correct, but it is a
  per-request database cost on the hot path and should be measured.
- **Audit-log race condition** — `getDocumentAccessPolicy` (`documentHelpers.js:136`) uses the
  global Prisma client rather than the transaction passed by its caller, so two concurrent
  revocations can both read `isActive: true` and both write a `REVOKED` audit record.
- **Divergent lifecycle transition tables** — `documentHelpers.validDocumentTransitions`
  (`READY: ["DELETED"]`) omits `READY → "QUEUED"`, which `documentLifecycle.service.js:41-47`
  includes. The helper's copy is exported and would reject a legitimate version upload. Neither
  table lists `QUEUED → "FAILED"`, which `uploadDocumentVersion` now writes on dispatch failure;
  no validator is consulted on that path, so it is not rejected. The validator is also only ever
  applied to the `→ SUBMITTED` hop, never to the transitions that actually move a document.
- **Plain `Error` instead of `ApiError`** — `query.service.js`, `queryHistory.service.js`,
  `llm.service.js`, and `prompt.service.js` throw bare `Error` for missing organization,
  `PROMPT_REQUIRED`, `CONTEXT_REQUIRED`, and `EMPTY_LLM_RESPONSE`. `error.middleware.js` reads
  `err.statusCode || 500`, so all of these return 500 instead of 400/403.
- **Query history can lose a paid answer** — `saveQueryHistory` (`query.service.js:24`) runs
  after generation; if the insert fails the whole request 500s and the completed LLM response is
  discarded.
- **Multer errors surface as 500** — `upload.middleware.js` enforces a 25 MB limit, but
  `MulterError` has no `statusCode`, so an oversized upload returns 500 instead of 413.
- **`retryAfter` is dropped and nothing is logged** — `error.middleware.js` serialises only
  `{ success, message }`, discarding `error.retryAfter` set by the rate limiter, and never logs
  the error or its stack. Every 500 in the system is currently unlogged.
- **Redis outage stalls every Redis-backed request by ~10 s** — `config/redis.js:15-20` sets
  `maxRetriesPerRequest: 10` with `commandTimeout: 10000` on the shared client, so a command issued
  while disconnected waits for the full 10 s command timeout before it rejects. The fail-open
  `catch` blocks are correct, but they only run after that stall, so a Redis outage does not take
  the API down — it makes every rate-limited, cached, and login path hang. `commandTimeout`, not the
  retry count, is what dominates: the retries never exhaust first. Measured at 10007.6 ms against a
  refused endpoint and 10007.3 ms against a blackholed route, versus 39.7 ms median for the same
  call with Redis healthy. Setting `enableOfflineQueue: false` on the shared client reduces the
  outage path to ~0.1 ms; it must be overridden back to `true` for `bullmqConnection`, which needs to
  queue commands while reconnecting. Not applied — see Recent Changes 2026-10-05.
- **Redis TLS is unconditional** — `config/redis.js:10` sets `tls` regardless of
  `config.redis.enabled` or whether the target speaks TLS. Harmless for the current deployment,
  which is Upstash over TLS, but it breaks any plain local Redis.
- **Redis is a single shared dependency with no fallback for reads** — both query caches and both
  rate limiters degrade, but there is no circuit breaker, so every request during an outage pays
  the full 10 s rather than being short-circuited at the middleware.
- **Storage bucket is ignored** — `getDownloadUrlFromS3` uses `config.aws.bucket` and never
  reads the persisted `version.storageBucket`, so a bucket rotation would produce 404s.

## Dead Code

- `prompt.service.js::buildSystemPrompt` — never imported. Its absence from the Bedrock call is
  Blocking Defect 2.
- `config/ai.js` (`aiClient`) — never imported; `documentAI.service.js` and `queryAI.service.js`
  create ad-hoc clients with inconsistent timeouts.
- `authRateLimit.service.js::getLoginRateLimitConfig` — never imported; the thresholds are
  hardcoded rather than read from `config.rateLimit` the way the query and upload limiters are.
- `queryAccessCache.service.js::buildQueryAccessScopeHash` — exported but never imported.
  `documentAccess.service.js::getQueryAccessScopeFingerprint` builds the hash with its own
  private `buildAccessScopeHash`, so this duplicates live logic.
- `context.service.js::buildContext` — never imported.
- `expireDocumentDrafts` — no route triggers bulk draft expiry.
- `config/bullmq.js::connection` — assigned from `bullmqConnection` when Redis is enabled, but
  both consumers import `bullmqConnection` (`document.worker.js`) or `documentProcessingQueue`
  (`documentQueue.service.js`) directly, so the alias is unused.
- `documentQueue.service.js::getProcessingJOb`, `removeProcessingJob` — never called.
- `health.routes.js` imports `auth` and never uses it. `documentLifecycle.service.js` imports
  `getDocument` and never uses it.
- `documentHelpers.js` duplicates the expiry window, classification list, transition table, and
  draft-cleanup logic already present in `documentLifecycle.service.js`.

---

# Recent Changes (2026-10-05)

## Email Normalization

`loginUser` normalized the email before lookup but `registerUser` stored and checked the raw input.

- `utils/email.js` (new) — `normalizeEmail` and `normalizeRequiredEmail`, the single canonical
  form (`trim().toLowerCase()`) used by every email write and lookup.
- `auth.services.js` — `registerUser` normalizes before the duplicate check and stores the
  normalized value, so the stored form and the login lookup form are the same string by
  construction rather than by convention.
- `auth.services.js` — the duplicate check uses `findFirst` with `mode: "insensitive"` instead of
  `findUnique`, so a legacy uppercase row still blocks a duplicate registration before the schema
  backfill has run.
- `auth.services.js` — `prisma.user.create` catches Prisma `P2002` and rethrows 409. The pre-read
  duplicate check is not atomic, so two concurrent registrations can both pass it; the unique
  index is the real guard and its violation previously surfaced as a 500.
- `auth.services.js` — `loginUser` calls the shared normalizer. Behavior is unchanged; the inline
  `email.trim().toLowerCase()` and its comment moved into the util.
- `auth.services.js` — a missing or non-string email is now a 400 (`Email is required.`) instead
  of a `TypeError` from `.trim()` on `undefined`, which the error middleware turned into a 500.

Once registration stored lowercase, `createInvitation` matching the inviter's typed address
against `User.email` with `findUnique` would no longer match an existing member, so an admin
inviting `Alice@Corp.com` could have invited a current member into their own organization.
`invitation.service.js` now normalizes the supplied email, and both the `existingMember` check and
the pending-invitation duplicate check match case-insensitively.
### Case-Insensitive Uniqueness

The application-level check alone is advisory — any future write path that forgets to normalize
reintroduces the duplicate-account defect. The constraint therefore also moved into the schema, so
uniqueness holds regardless of what a caller writes. See [`docs/DATABASE.md`](DATABASE.md) — Schema
Changes 2026-10-05.

The duplicate check in `auth.services.js` still runs before the insert, so it returns a clean 409
rather than surfacing a constraint violation. `P2002` is caught as a backstop for the concurrent case
the pre-read cannot cover.


## Failed Processing Reaches `FAILED`

`processDocument` called `handleProcessingFailure(error)` before
`markProcessingFailed(...)` inside its `catch`, and `handleProcessingFailure` was
`async function(error){ throw error; }` — it rethrew, so the line after it never executed. Every
AI processing error left the document in `PROCESSING` indefinitely.

- `documentProcessing.service.js` — the `catch` block now calls `markProcessingFailed` first and
  rethrows the original error afterwards. The `handleProcessingFailure` import was dropped.
- `documentProcessing.service.js` — the `markProcessingFailed` call is wrapped in its own
  `try/catch` that logs and swallows, so a failure *while recording* the failure cannot replace
  the original error. The original `error` is always what propagates.
- `documentAI.service.js` — `handleProcessingFailure` deleted. It was a pure rethrow with no side
  effect; keeping it in the call chain was the defect itself. `handleProcessingSuccess` was a pure
  pass-through and is left in place, since it is not part of this defect.

`markProcessingFailed` guards on `status: "PROCESSING"` and `currentVersionId: versionId`, and
only writes `DocumentVersion.processingStatus` when the guarded `updateMany` matched exactly one
row. Three error classes in `processDocument` are therefore handled correctly rather than blindly
flipped to `FAILED`:

| Error | Guard result |
| --- | --- |
| 409 `Document is not available for processing.` — thrown when `updateProcessingStatus` matched 0 rows, so the document never entered `PROCESSING` | No match, nothing written. A document that was not being processed is not marked failed. |
| 404 `Document or version not found.` — thrown after the document was moved to `PROCESSING` | Match, document and version both go to `FAILED` |
| AI service / S3 / payload error | Match, document and version both go to `FAILED` |

The 409 case matters: without the status guard, a duplicate or stale job would mark a healthy
`READY` document as `FAILED`.

`processDocument` still rethrows after marking, so the BullMQ worker records the job as `failed`
and the queue's 3-attempt backoff still applies. A retry re-enters `processDocument`, which moves
the document back to `PROCESSING` and can therefore still reach `READY`. Retry and manual reprocess
now compose instead of contradicting each other. `reprocessDocument` requires `status === "FAILED"`,
so that endpoint is reachable for the first time.

## Version Upload No Longer Deletes Its Own File

`uploadDocumentVersion` ran the S3 upload, the database transaction, and
`dispatchDocumentProcessing` inside a single `try`, and the `catch` deleted the S3 object whenever
anything in that block threw. A dispatch failure after the transaction had already committed
therefore destroyed the file that the newly committed `DocumentVersion.storageKey` pointed at. The
row survived, the object did not.

- `documentLifecycle.service.js` — dispatch moved out of the transaction's `try`. The block now
  covers only the S3 upload and the database transaction.
- `documentLifecycle.service.js` — an `uploadCommitted` flag gates the S3 delete. The object is
  removed only when the transaction did not commit, which is the only case where no row references
  it.
- `documentLifecycle.service.js` — a dispatch failure now moves the document to `FAILED` rather
  than leaving it in `QUEUED`, and the original dispatch error is rethrown.

The S3 object has two possible owners: no database row, or exactly one
`DocumentVersion.storageKey`. Deleting is only safe in the first case.

| Outcome | `uploadCommitted` | S3 object | Reason |
| --- | --- | --- | --- |
| `uploadFileToS3` throws | `false` | Deleted | Nothing references it |
| Transaction throws and rolls back | `false` | Deleted | The `DocumentVersion` row was never created |
| Transaction commits, dispatch throws | `true` | **Kept** | A committed row now references it |
| Transaction commits, dispatch succeeds | `true` | Kept | Normal path |

The rollback case is why the flag tracks commit success rather than "did we get as far as the
transaction": a rollback means the version row is gone even though the object exists.

The new `FAILED` write is guarded on `currentVersionId` and `status: "QUEUED"`, so the
`QUEUED → FAILED` transition applies only to the version this call created. That guard matters
because `dispatchDocumentProcessing` falls back to direct `processDocument` when Redis is
disabled, so a dispatch error can also be an in-flight processing error that has already moved the
document to `FAILED`. The guard makes the second write a no-op there rather than clobbering state
the worker owns. The version write is inside the same transaction and conditional on the document
update matching, so the two rows cannot diverge. Combined with the processing-failure fix above, a
dispatch failure is now recoverable through `reprocessDocument` instead of requiring a new upload.

## Redis Latency Benchmark

Added `backend/scripts/bench-redis.mjs` (`npm run bench:redis`) to quantify what Redis costs on the
happy path and what an outage costs on the degraded path. It runs the exact token-bucket Lua script
that `queryRateLimiter` and `documentUploadRateLimiter` invoke, so the numbers are the ones the
middleware actually experiences.

Because the deployment targets Upstash over TLS, there is no local Redis process to stop. The
script instead measures both states side by side by pointing the client at dead endpoints, which is
client-side indistinguishable from an outage: `127.0.0.1:6399` for connection-refused and
`198.51.100.1:6379` for a blackholed route. Six scenarios run in one pass — each of the three
targets against the current connection options and against the fail-fast options.

Measured on 2026-10-05:

| Scenario | Connect | Median command |
| --- | --- | --- |
| Redis up / current options | 591.4 ms | 39.7 ms |
| Redis up / fail-fast options | 185.0 ms | 45.0 ms |
| Redis refused / current options | — | 10007.6 ms |
| Redis refused / fail-fast options | — | 0.1 ms |
| Redis blackhole / current options | — | 10007.3 ms |
| Redis blackhole / fail-fast options | — | 0.1 ms |

The ~40 ms happy-path figure is Upstash round-trip latency over TLS to a remote host, not local
Redis latency. It is the per-request floor for any endpoint behind the rate limiter.

The outage figure is 10.0 s, set by `commandTimeout: 10000` rather than by the retry budget, and it
applies to every Redis-backed path: the rate limiters, the login rate limiter, and both query
caches. With `enableOfflineQueue: false` the same path costs 0.1 ms, so the fail-open `catch`
becomes effectively instant.

The fail-fast options show 45.0 ms against 39.7 ms on the happy path. That 5 ms gap is within
run-to-run variance at 10 iterations and is not evidence of a regression; raise the iteration count
before drawing a conclusion.

`[ioredis] Unhandled error event` lines printed during the refused scenarios are an artifact of the
benchmark client, which registers no error listener. `config/redis.js:55` attaches one, so the
running application does not emit them.

## Files Changed

| File | Change |
| --- | --- |
| `backend/scripts/bench-redis.mjs` | New: side-by-side latency benchmark across live, refused, and blackholed Redis |
| `backend/package.json` | Added `bench:redis` script |
| `docs/DEVELOPMENT.md` | Outage stall re-recorded as a measured 10 s figure under Reliability and Consistency Issues |

The recommended fix — `enableOfflineQueue: false` on the shared client, overridden back to `true`
for `bullmqConnection` — is **not** applied. The benchmark measures it as a candidate, so the
comparison stays available if the options are reverted.

---

## Physical Cleanup Succeeds

`cleanupDeletedDocument` and `cleanupExpiredDrafts` both deleted every
`DocumentVersion` row for the document before deleting the `Document` row, while
`Document.currentVersionId` still pointed at one of them. The relation is `onDelete: Restrict`, so the
version delete was rejected every time and the transaction rolled back. Deleted documents and expired
drafts could never be physically removed, so S3 objects, versions, policies, and audit rows leaked
indefinitely.

- `documentLifecycle.service.js` — `cleanupDeletedDocument` now nulls `currentVersionId` before
  deleting versions, after the audit and policy rows are removed.
- `documentLifecycle.service.js` — `cleanupExpiredDrafts` applies the same nulling step per
  document. It does not remove audit or policy rows, which is correct: an expired draft was never
  published, so it never had any.
- `documentLifecycle.service.js` — the empty `catch{}` blocks around the S3 deletes in both paths
  now log the object key and the error. They were hiding the fact that S3 cleanup was failing
  independently of the database failure.

### Verification against the development database

Two read-only probes were run against the development database and then discarded; the findings are
recorded here and the scripts were not kept.

The first reported the backlog the defect had accumulated:

- 6 soft-deleted documents awaiting cleanup, **all 6 with `currentVersionId` set**
- 1 expired document awaiting cleanup, with `currentVersionId` set
- 0 draft documents

The second ran both statement orders against one soft-deleted document, each inside a transaction
that was deliberately rolled back. The document and its version were confirmed still present
afterwards.

| Order | Result |
| --- | --- |
| `deleteMany(versions)` → `delete(document)` — current | **Failed**: Postgres `23001`, `violates RESTRICT setting of foreign key constraint "Document_currentVersionId_fkey"` |
| `update(currentVersionId: null)` → `deleteMany(versions)` → `delete(document)` — fixed | Completed with no error |

Note the failure arrives as a Prisma `ConnectorError` with no `code`, **not** as `P2003`. Code that
catches specifically on `P2003` will not match a foreign-key rejection on this relation.

### Correction to the previous audit

Two claims in the 2026-09-30 audit were wrong and are corrected here:

- The error is **not** Prisma `P2003`. It arrives as a Postgres `23001` wrapped in a Prisma
  `ConnectorError`, which has no `code`. Anything catching specifically on `P2003` will not match.
- `cleanupDraftUpload` did **not** get the ordering right. It deleted the version first and nulled
  `currentVersionId` second, which is the same defect. It happened not to surface because no draft
  document currently exists, but `uploadDraft` does set `currentVersionId` to the uploaded version,
  so `DELETE /drafts/:documentId/upload` would have failed the same way. Its ordering is fixed as
  well.
The real `cleanupDeletedDocument` endpoint was not invoked, because doing so would have destroyed a
document and its S3 object. The evidence above is the statement-level probe, not an end-to-end run.

### Residual note

S3 objects are still deleted *before* the database transaction rather than after it. If the
transaction fails, rows remain pointing at objects that no longer exist. That ordering was left
alone here — the mirror of the version-upload fix above, where dispatch ran inside the transaction and
a post-commit failure deleted live data. It is a separate design question.

## Access Management Is Not Single-Owner

The only code path that created a `MANAGE_ACCESS` policy was
`createInitialDocumentAccessPolicies`, which runs inside `publishDraft` and always created a single
`USER`-subject ALLOW policy for the publisher. Since `validateDocumentAccessAuthority` resolves
authority from `MANAGE_ACCESS` policies on the target document, and `DocumentAccessPolicy.documentId`
is `NOT NULL`, no tenant-wide policy was expressible. Every grant, update, and revoke was therefore
reachable only by the member who uploaded the document, and the very first delegation was itself
gated on the authority being delegated.

Measured on the development database before the fix: 7 `MANAGE_ACCESS` policies, all
`subjectType: "USER"`, **0 held by anyone other than the uploader**, across a single distinct uploader.
2 of 9 published documents had no `MANAGE_ACCESS` policy at all and so could not be managed by
anyone.

- `documentLifecycle.service.js` — `createInitialDocumentAccessPolicies` additionally creates a
  `ROLE`-subject ALLOW `MANAGE_ACCESS` policy for `OWNER` and for `ADMIN`, alongside the existing
  uploader policies. Only `MANAGE_ACCESS` is granted this way; `QUERY`, `VIEW`, and `DOWNLOAD` remain
  uploader-scoped.
- Migration `20261005140000_seed_manage_access_role_policies` backfills the same two policies for
  every already-published document; see [`docs/DATABASE.md`](DATABASE.md) — Schema Changes 2026-10-05.

Because `subjectType: "ROLE"` policies are matched by `documentAccessPolicyMatchesUser` against
`user.role`, and `resolveDocumentAccessTargetUnit` resolves `ROLE` to the organization root unit,
these policies require no change to the authorization check itself. DENY precedence is untouched: a
`DENY` policy matching the user still overrides an `ALLOW`.

### Scope note

This grants standing `MANAGE_ACCESS` to every `ADMIN` in the tenant on every document. That is a
deliberate widening of administrative scope: an `ADMIN` can now grant, edit, revoke, upload a new
version, and re-dispatch processing for documents they did not upload. Narrowing it to specific
roles or units is a policy decision, not a code one — the `ROLE` subject and `UNIT_AND_DESCENDANTS`
scope already exist and would express it without another migration.

The backfill migration and its verification are documented in
[`docs/DATABASE.md`](DATABASE.md) — Schema Changes 2026-10-05.

## Files Changed (2026-10-05)

| File | Change |
| --- | --- |
| `backend/src/utils/email.js` | New: `normalizeEmail`, `normalizeRequiredEmail` |
| `backend/src/services/auth.services.js` | Normalized registration; case-insensitive duplicate check; `P2002` mapped to 409; shared normalizer in login; missing email is a 400 |
| `backend/src/services/invitation.service.js` | Normalized invite email; case-insensitive member and pending-invitation lookups |
| `backend/src/services/document/documentProcessing.service.js` | `catch` marks the version failed before rethrowing; `markProcessingFailed` errors logged and swallowed so the original error survives; `handleProcessingFailure` import removed |
| `backend/src/services/document/documentAI.service.js` | `handleProcessingFailure` deleted |
| `backend/src/services/document/documentLifecycle.service.js` | Dispatch moved out of the transaction `try`; commit-gated S3 delete; dispatch failure marks document and version `FAILED` under a guarded transaction; both physical-cleanup paths null `currentVersionId` before deleting versions and log S3 delete failures; `cleanupDraftUpload` ordering corrected; `createInitialDocumentAccessPolicies` seeds `OWNER` and `ADMIN` `MANAGE_ACCESS` policies |
| `backend/prisma/migrations/20261005140000_seed_manage_access_role_policies/migration.sql` | New: idempotent backfill of role-subject `MANAGE_ACCESS` policies for published documents — details in `docs/DATABASE.md` |
| `backend/prisma/schema.prisma` | `User.email` is `@db.Citext` — details in `docs/DATABASE.md` |
| `backend/prisma/migrations/20261005101500_normalize_user_email/migration.sql` | New: citext, duplicate guard, lowercase backfill, column type change — details in `docs/DATABASE.md` |
| `docs/DATABASE.md` | Schema Changes 2026-10-05: `citext` email, `ROLE`-subject `MANAGE_ACCESS` provisioning; updated migration list and Schema Risks |
| `docs/DEVELOPMENT.md` | Items 1–5 marked resolved, status table and phase notes updated |

Both migrations were applied to the development database and verified; see `docs/DATABASE.md`. The
two processing fixes pass `node --check` but were **not** exercised against a live AI service,
database, S3, or Redis — the state-transition reasoning is from reading the guarded queries, not
from a run.

---

# Recent Changes (2026-10-04)

Defect-fixing pass over the 2026-09-30 audit. Two blocking defects, five authorization-gap rows,
and the `policy.scope` gap in `authorizeDocumentAction` were closed; the Redis-dependent subsystems
(both query caches, login rate limiting, API rate limiting) became live for the first time.

## Shared Redis Client

`config/redis.js` default-exported a plain connection *options* object, and four consumers treated
it as a connected client. Every Redis call threw a `TypeError` that a `try/catch` swallowed, so
both query caches, login rate limiting, and API rate limiting silently did nothing.

- `config/redis.js` — now creates and exports a real `redisClient` (`new Redis(redisConnection)`,
  `null` when `REDIS_ENABLED` is not `true`) alongside the raw `redisConnection` options, and logs
  `connect`, `ready`, `error`, and `close` on it. Both a named and the default export remain.
- `config/bullmq.js` — derives `bullmqConnection` as
  `{ ...redisConnection, maxRetriesPerRequest: null }`, the value BullMQ requires for a blocking
  `Worker`. `connection` is now assigned from it instead of staying `null`.
- `workers/document.worker.js` — imports `bullmqConnection` from `config/bullmq.js` rather than the
  raw options, so the blocking worker no longer receives `maxRetriesPerRequest: 10`.
- `middleware/rateLimit.middleware.js` — dropped its private `Redis` instance and uses the shared
  `redisClient`; `consumeToken` is registered on it, and both guards short-circuit on
  `!redisClient`.
- `query/queryCache.service.js`, `query/queryAccessCache.service.js`,
  `services/authRateLimit.service.js` — all switched from `redisConnection` to `redisClient`.

Consequence: `invalidateOrganizationQueryCache` after successful processing and
`invalidateOrganizationAuthorizedQueryCache` after a policy mutation now actually invalidate. TLS
is still set unconditionally in `redisConnection`, which remains an open issue for a plain local
Redis.

## Document Access Authority

`validateDocumentAccessAuthority` called
`hasPermission(user.id, "MANAGE_ACCESS", …)`, but `MANAGE_ACCESS` is only a
`DocumentAccessAction`, not a `Permission`, so Prisma rejected it at runtime.

- `documentAccess.service.js` — dropped the `hasPermission` import entirely. Authority is now
  resolved from `documentAccessPolicy` rows with `action: "MANAGE_ACCESS"` scoped to the
  document's organization: DENY wins, an ALLOW match is required, and an empty match set is a 403.
- `documentAccess.service.js` — new `isUnitWithinScope(tx, scopeUnitId, targetUnitId)` walking the
  unit `parentId` map, and new `documentAccessPolicyMatchesUser(tx, policy, user, targetUnitId)`
  applying `UNIT_ONLY` / `UNIT_AND_DESCENDANTS`, plus `ORGANIZATION`, `ROLE`, and `USER` subjects.
- `documentAccess.service.js` — `getDocumentAccessPolicies`, `getDocumentAccessHistory`, and
  `getDocumentAccessPolicyById` call `authorizeDocumentAction(user, documentId, "MANAGE_ACCESS")`
  before returning policies or audit rows.
- `documentAccess.service.js` — `authorizeDocumentAction` rejects a user with no unit (403), scopes
  the policy query to `user.unit.organizationId`, and matches `UNIT_AND_DESCENDANTS` through the new
  `getUserUnitHierarchy` helper, so it now agrees with `authorizeQueryDocuments`.

No migration was required for this change. Authority for access management is resolved from
`DocumentAccessPolicy` rows rather than from `PermissionGrant`; see
[`docs/DATABASE.md`](DATABASE.md) — Schema Risks for the underlying modelling gap.

## Document Lifecycle Authorization

- `documentLifecycle.service.js` — new `authorizeDraftOwner(user, document)`, requiring
  `document.uploadedById === user.id`. Applied in `updateDocumentDraft`, `uploadDraft`,
  `deleteDraftUpload`, `publishDraft`, and in the `DRAFT` branch of `getDocumentById`,
  `getDocumentVersions`, and `getDocumentVersionById`.
- `documentLifecycle.service.js` — `getDocuments` now returns only the caller's own drafts plus
  documents that pass `authorizeDocumentAction(user, document.id, "VIEW")`, swallowing 403 and
  rethrowing anything else.
- `documentLifecycle.service.js` — `getDocumentById`, `getDocumentVersions`, and
  `getDocumentVersionById` require `VIEW` for non-draft documents, so `storageKey`, `checksum`, and
  `storageBucket` are no longer exposed to any tenant member.
- `documentLifecycle.service.js` — `softDeleteDocument`, `restoreDocument`, and
  `cleanupDeletedDocument` require the caller to be the uploader. `restoreDocument` additionally
  rejects a document with no `currentVersionId`, though it still sets `status: "READY"`
  unconditionally.
- `documentLifecycle.service.js` — `uploadDocumentVersion` requires
  `authorizeDocumentAction(user, documentId, "MANAGE_ACCESS")`.

## Document Processing State

- `documentProcessing.service.js` — `processDocument` writes
  `DocumentVersion.processingStatus` at each transition (`PROCESSING`, and `READY`/`FAILED` from
  `markProcessingReady` / `markProcessingFailed` inside a transaction that only touches the version
  when the guarded document update actually matched). Previously the column was never written and
  every version stayed `PENDING`.
- `documentProcessing.service.js` — `processDocument` throws 409 when the guarded
  `updateProcessingStatus` does not match, instead of running the AI service against a document that
  is not in the expected state.
- `documentProcessing.service.js` — `reprocessDocument({ user, documentId, versionId })` now takes
  the user, returns 404 for a missing document, then calls
  `authorizeDocumentAction(user, documentId, "MANAGE_ACCESS")` before the status and version checks,
  and resets the version's `processingStatus` to `QUEUED`.
- `document.controllers.js` — the `reprocessDocument` handler forwards `req.user` into the service.
- `documentQueue.service.js` — the BullMQ `jobId` is now `${documentId}-${versionId}-${Date.now()}`.
  The previous id made BullMQ drop a re-dispatch as a duplicate, so a re-queued document stayed in
  `QUEUED` forever while the API returned 202.

`handleProcessingFailure` was removed on 2026-10-05, so a document that fails in the AI service now
reaches `FAILED`.

## Permission Revocation

- `permission.service.js` — `hasPermission` and `getUserPermissions` also filter `revokedAt: null`.
  A re-invited member previously regained every permission they had before removal.
- `organization.service.js` — `removeMember` sets `isActive: false` alongside `revokedAt` on the
  revoked grants.

## Invitation Hardening

- `invitation.service.js` — `createInvitation` validates `role` against an allow-list of
  `["MEMBER", "ADMIN"]` and returns 400 for anything else, so a caller with `INVITE_MEMBER` +
  `ASSIGN_ROLE` can no longer invite an `OWNER`. `ASSIGN_ROLE` is still required for any non-`MEMBER`
  role.
- `invitation.service.js` — `acceptInvitation` loads the invitation outside the transaction and, for
  a `PENDING` invitation past `expiresAt`, writes `status: "EXPIRED"` in its own update before
  throwing 400. The previous in-transaction update always rolled back with the throw.

## Files Changed

| File | Change |
| --- | --- |
| `backend/src/config/redis.js` | Added a shared connected `redisClient` export |
| `backend/src/config/bullmq.js` | `bullmqConnection` with `maxRetriesPerRequest: null`; `connection` assigned |
| `backend/src/workers/document.worker.js` | Worker uses `bullmqConnection` |
| `backend/src/middleware/rateLimit.middleware.js` | Uses the shared `redisClient` instead of a private instance |
| `backend/src/middleware/loginRateLimit.middleware.js` | Null-safe `result`, numeric `retryAfter` |
| `backend/src/services/authRateLimit.service.js` | Uses the shared `redisClient`; returns `{ blocked: false }` when disabled |
| `backend/src/services/query/queryCache.service.js` | Uses the shared `redisClient` |
| `backend/src/services/query/queryAccessCache.service.js` | Uses the shared `redisClient` |
| `backend/src/services/document/documentAccess.service.js` | `MANAGE_ACCESS` authority from policies; `isUnitWithinScope`; `documentAccessPolicyMatchesUser`; scope-aware `authorizeDocumentAction`; `MANAGE_ACCESS` checks on policy and history reads |
| `backend/src/services/document/documentLifecycle.service.js` | `authorizeDraftOwner`; `VIEW` filtering in list/get/version paths; ownership on delete, restore, cleanup; `MANAGE_ACCESS` on version upload |
| `backend/src/services/document/documentProcessing.service.js` | Version-level `processingStatus` writes; 409 on unexpected state; authorized `reprocessDocument` |
| `backend/src/services/document/documentQueue.service.js` | Non-colliding BullMQ `jobId` |
| `backend/src/controllers/document.controllers.js` | Forwards `req.user` to `reprocessDocument` |
| `backend/src/services/permission.service.js` | `revokedAt: null` filters |
| `backend/src/services/organization.service.js` | `removeMember` deactivates grants |
| `backend/src/services/invitation.service.js` | Role allow-list; out-of-transaction expiry marking |

No schema change in this entry. `documentAccess.service.js` and `documentLifecycle.service.js` also
carry a whitespace-only reformat across most of their bodies; one behavior was lost in that
reformat, recorded under Known Backend Issues.

---

# Recent Changes (2026-09-30)

## Processing Worker Execution

The BullMQ worker existed as a file but was never instantiated, so queued document jobs were
accepted by the queue and never consumed. Documents stayed in `QUEUED` indefinitely.

- `workers/document.worker.js` (new) — creates a `Worker` on the `document-processing` queue with
  `concurrency: 1`, reusing the shared connection from `config/redis.js`. The handler calls
  `processDocument({ documentId, versionId })` and logs `ready`, `completed`, `failed`, and `error`
  events. The worker is only created when `config.redis.enabled` is true.
- `server.js` imports `./src/workers/document.worker.js` at startup, alongside
  `initializeDocumentQueue`. Producer and consumer now both run inside the API process; a
  multi-instance deployment would need a dedicated worker process.
- `documentQueue.service.js` — the job id separator changed from `:` to `-`. BullMQ treats `:` as
  its custom-id separator, so `${documentId}:${versionId}` was parsed as a custom job id rather than
  the literal string, breaking deduplication when the same version was dispatched again.

## Document Reprocessing

Failed documents previously had no recovery path other than uploading a new version.

- `documentProcessing.service.js` — new `reprocessDocument`. It loads the document, throws 404 if
  missing, throws 400 unless `status === "FAILED"`, throws 400 unless `versionId` is the current
  version, sets the document back to `QUEUED`, and re-dispatches through the normal dispatcher, so
  it respects `REDIS_ENABLED` and falls back to direct processing.
- `document.controllers.js` — new `reprocessDocument` handler returning 202 with "Document
  reprocessing queued successfully."
- Registered at `POST /:documentId/versions/:versionId/reprocess` in `document.routes.js`. At the
  time of this entry the route passed no user and the service performed no authorization or tenant
  check; both were fixed on 2026-10-04, and the route is still not covered by
  `documentUploadRateLimiter`.

The endpoint was unreachable in practice until 2026-10-05, because the processing pipeline could
not produce a `FAILED` document.

## `processingError` Field Removal

- `documentProcessing.service.js` — `updateProcessingStatus`, `markProcessingReady`, and
  `markProcessingFailed` no longer write a `processingError` column, and the unused `errorMessage`
  parameter was dropped from `updateProcessingStatus`.
- `documentLifecycle.service.js` — `uploadDocumentVersion` no longer sets `processingError: null`
  when moving a document to `QUEUED`.

The column was never written by any code path; `DocumentVersion` has no `processingError` field, so
each of those writes would have raised a Prisma unknown-argument error and pushed a healthy document
into `FAILED`. See [`docs/DATABASE.md`](DATABASE.md) — Schema Risks.

## Missing Import Fix

- `documentLifecycle.service.js` — `getDocumentDownloadUrl` called
  `authorizeDocumentAction(user, documentId, "DOWNLOAD")` without importing it, raising a
  `ReferenceError` on every download request. The import from `documentAccess.service.js` is now
  present, so `DOWNLOAD` authorization is actually enforced before a presigned URL is issued.

## AI Processing Payload

- `documentAI.service.js` — the processing payload now includes
  `file_name: version.originalFileName` alongside `document_id`, `version_id`, `organization_id`,
  and `file_url`. The AI service previously derived the file extension from the presigned URL path,
  which broke whenever the S3 key did not end in a recognisable extension.
- `ai-service/app/schemas/processing.py` — `ProcessDocumentRequest` requires `file_name`
  (`min_length=1`); `DocumentProcessingService` takes the suffix from it instead of parsing the URL.
- `ai-service/app/services/extractors/base.py` — `BaseExtractor` gained `log_start`, `log_success`,
  and `log_failure` helpers so extraction timing and failures are logged consistently across
  formats.
- `document.controllers.js` — `publishDraft` and `getDocumentDownloadUrl` log caught errors before
  rethrowing.

## Authorized Retrieval Cache

The raw-candidate cache is shared across all users of a tenant, so it cannot store an authorized
result set — that would leak one user's permissions to another. This change adds a second,
per-access-scope cache for the authorized result.

- `services/query/queryAccessCache.service.js` (new) — tenant-scoped cache for the **authorized**
  candidate list. Keys are
  `rag:authorized-retrieval:{organizationId}:{accessScopeHash}:{topK}:{sha256(query)}` with a
  300-second TTL, plus `invalidateOrganizationAuthorizedQueryCache(organizationId)` using `SCAN` +
  `DEL`.
- `documentAccess.service.js` — new `getQueryAccessScopeFingerprint(user)`. It loads every `QUERY`
  policy in the organization, filters to those matching the user (ORGANIZATION, UNIT with
  `UNIT_ONLY` or `UNIT_AND_DESCENDANTS` against the resolved unit hierarchy, ROLE, USER), applies
  `isDocumentAccessPolicyActive`, sorts by policy id, and hashes the result together with
  `organizationId`, `unitId`, `role`, and the unit hierarchy. Two users with different effective
  access therefore never share a cache entry, and any change to a matching policy changes the hash
  and misses the cache.
- `grantDocumentAccess`, `updateDocumentAccessPolicy`, and `revokeDocumentAccess` invalidate the
  tenant's authorized-retrieval cache after their transaction commits, via a `.then()` chained onto
  `prisma.$transaction`.

Document version changes are not handled by invalidation. Instead the cache is re-validated on
read, which is stronger. `retrieveAuthorizedCandidates` was restructured into three steps:

- `validateCurrentCandidates(organizationId, candidates)` — filters candidates against a direct
  `prisma.document.findMany` for `status: "READY"`, `isDeleted: false`, and a non-null
  `currentVersionId` within the tenant. This runs on every cache read, so a cached authorized set
  cannot outlive a version change.
- `authorizeCandidates(user, candidates)` — calls `authorizeQueryDocuments` and filters to the
  current version, replacing the previous inline logic and the duplicate stale-candidate refresh
  branch.
- The main function reads the raw cache, computes the access fingerprint, reads the authorized cache,
  and only falls back to `authorizeCandidates` + `setCachedAuthorizedQuery` on a miss.

Both the raw cache and the authorized cache are always written with the candidate list produced by
that specific request.

## Login Rate Limiting

- `services/authRateLimit.service.js` (new) — fixed-window counters in Redis: 5 failed attempts per
  normalized email and 20 per IP within a 15-minute window. Exposes `checkLoginRateLimit`,
  `recordFailedLogin`, and `clearEmailLoginFailures`. Fails open on any Redis error so
  authentication stays available.
- `middleware/loginRateLimit.middleware.js` (new) — `loginRateLimiter` reads the email from the body
  and the IP from `req.ip`, calls the check, and rejects with a 429 carrying a `Retry-After` header.
  Missing email still receives IP-based protection.
- `auth.routes.js` — `POST /login` now runs `loginRateLimiter`. `POST /register` is still unlimited.
- `auth.controller.js` — `login` forwards `req.ip` to the service.
- `auth.services.js` — `loginUser` normalizes the email before lookup, records a failed attempt for
  both unknown-email and wrong-password cases using an identical 401 message, and clears the email
  counter on success. The IP counter is deliberately not cleared on success. An inactive account
  returns 403 without counting as a failure.

## Cleanup

Decorative `/* --- */` section banners were removed from `routes/document.routes.js` and
`services/query/query.service.js`. Explanatory comments were preserved; only the separator rules
and numbered titles were dropped.

---

# Recent Changes (2026-09-28)

## API Rate Limiting

Added a Redis-backed token bucket in front of the two expensive endpoints, so a single user cannot
exhaust LLM or processing capacity.

- `config/redis.js` — single shared Redis connection object (`host`, `port`, `username`, `password`,
  TLS with `rejectUnauthorized: false`, `maxRetriesPerRequest: 3`, `enableReadyCheck`,
  `lazyConnect: false`, 10s connect timeout, 5s command timeout, capped exponential retry, reconnect
  on `ECONNRESET` / `ETIMEDOUT` / `ECONNREFUSED` / `EHOSTUNREACH`). It is created only when
  `config.redis.enabled` is true.
- `middleware/rateLimit.middleware.js` — token bucket implemented as an atomic Lua script, registered
  with `redis.defineCommand("consumeToken")`. Exports `queryRateLimiter` and
  `documentUploadRateLimiter`.
- `config/bullmq.js` stopped building its own connection object; it imports `redisConnection` from
  `config/redis.js` and reuses it for the `document-processing` queue, so retry, TLS, and timeout
  behavior is identical between the queue and the rate limiter.

### Behavior

- Buckets are keyed per user: `rate-limit:{prefix}:user:{userId}`.
- Tokens and timestamp are stored in a Redis hash; the bucket key expires after
  `capacity / refillRate * 2` seconds so idle buckets are removed.
- A rejected request throws `ApiError` with status 429 and a `retryAfter` value in seconds.
- `refillRate` is configured per interval and divided by `refillIntervalSeconds` to obtain a
  per-second rate.
- Missing `req.user.id` throws 401.
- The limiter is a no-op when `REDIS_ENABLED` is not `true`, and it **fails open** on any Redis
  error so a Redis outage does not take down the API.

### Route Wiring

- `query.routes.js` — `POST /api/v1/query` now runs `authenticate` then `queryRateLimiter`.
- `document.routes.js` — `POST /drafts/:documentId/upload` and `POST /:documentId/versions` now run
  `authenticate`, `documentUploadRateLimiter`, then `upload.single("file")`. The limiter runs before
  Multer so rejected requests do not consume upload bandwidth or disk.

Rate limit environment variables are listed under Local Setup.

---

# Recent Changes (2026-09-27)

## Query History Persistence

Every executed query is now persisted so answers can be listed per user later, and so retrieval
quality can be evaluated offline. See `docs/DATABASE.md` — Query History for the schema.

- `query.service.js` — new `saveQueryHistory` helper, writing a record on both return paths: the
  evidence-insufficient fallback and the generated-answer path.
- The stored record keeps the guarded answer, not the raw LLM output.
- History is written after the output guardrail runs, so blocked output is recorded with
  `outputGuardPassed: false`.
- `organizationId` is resolved from `user.unit.organizationId`, the same source used for
  authorization and cache scoping. A missing organization or user id throws instead of writing a
  partial record.
- The insufficient-evidence response now also returns `outputGuardPassed: false`, making the response
  shape consistent across both paths.
- `queryHistory.service.js` — `getQueryHistory(user, limit, offset)`, scoped to the caller's
  organization and user, ordered by `createdAt` descending.
- `queryHistory.controller.js` — `getUserQueryHistory` with `limit` (integer, 1–100, default 20) and
  `offset` (non-negative integer, default 0) validation returning HTTP 400 on invalid input.
- `queryHistory.routes.js` — mounted at `/query/history` behind `authenticate`.
- The response does not expose the `organizationId` or `userId` columns.

## Version-Aware Query Caching & Cache Invalidation

Implemented version-aware caching to prevent stale retrieval results after document updates, and
cache invalidation after successful document processing.

- `queryCache.service.js` — tenant-scoped Redis retrieval cache with SHA-256 query keys, 300-second
  TTL, cached candidate arrays, and organization-level invalidation.
- `documentProcessing.service.js` — version-safe processing status updates using `documentId`,
  `currentVersionId`, and current status; successful processing invalidates the organization's
  retrieval cache.
- `query.service.js` — validates cached candidates against `currentVersionId`, re-fetches stale cache
  results from the AI service, and filters candidates to the current version.
- `documentAccess.service.js` — `authorizeQueryDocuments` filters to READY documents with a current
  version and returns `{ documentId, currentVersionId }`.

### Behavior

- Cached candidates are checked against the current document version.
- Stale cached candidates trigger fresh AI retrieval.
- Candidates from superseded versions are excluded before reranking and LLM generation.
- Old document versions remain stored in Qdrant for historical/version-aware functionality.
- Successful document processing invalidates tenant retrieval caches.

## Other

- `bullmq.js` — Redis connection sets `enableReadyCheck` and `lazyConnect: false`, and logs
  `connect`, `ready`, `error`, and `close` events.
- `query.routes.js` — imports `authenticate` as a default export, matching the middleware module.
- `documentAccess.service.js` — file header comment added; no behavior change.
- `query.service.js` — reformatted to the project's spacing conventions.
- `axios` added to backend dependencies.

The query history response shape is documented under Platform API.

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
- Qdrant has an `organization_id` payload index, every indexed point stores `organization_id`, and
  search filters by it.

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

API base path:

```text
/api/v1
```

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
| `QUERY_RATE_LIMIT_REFILL_RATE` | `0.5` | Query tokens added per interval |
| `QUERY_RATE_LIMIT_REFILL_INTERVAL` | `1` | Query refill interval in seconds |
| `DOCUMENT_UPLOAD_RATE_LIMIT_CAPACITY` | `10` | Upload bucket size |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_RATE` | `1` | Upload tokens added per interval |
| `DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_INTERVAL` | `60` | Upload refill interval in seconds |

---

# Completed Phases

## Phase 1 — Backend Foundation ✅

Express.js REST API, versioned routing, PostgreSQL + Prisma ORM, shared configuration, global
error handling, shared API response utilities, environment configuration.

## Phase 2 — Authentication & Identity ✅

User registration and login, JWT authentication, password hashing, current-user endpoint,
authentication middleware, `req.user` context resolution.

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

## Phase 3 — Organization Management ✅

Organization creation, automatic COMPANY root creation, hierarchical structure, tenant isolation,
organization unit CRUD, hierarchy validation, protected deletion rules.

Supported hierarchy:

```text
COMPANY
└── DEPARTMENT
    └── TEAM
        └── GROUP
```

## Phase 4 — Access & Administration ✅

**Permissions** — scoped permissions, delegated authority, permission history, permission
revocation, transaction-safe validation.

**Invitations** — invitation creation, secure invitation tokens, invitation acceptance, expiration
handling, revocation, capacity validation. Email delivery is planned for a later phase.

**Members** — member listing, role updates, unit movement, member removal, owner protection,
permission cleanup.

**Organization capacity** — parent capacity enforcement, allocation tracking, over-allocation
prevention.

**Reorganization** — unit movement, subtree movement, circular-reference protection, capacity
validation.

**Synchronization** — organization revision tracking, stale-state detection, multi-user
synchronization.

**Concurrency protection** — serializable Prisma transactions, automatic retry for Prisma `P2034`,
transaction-safe organization mutations.

## Phase 5 — Document Management ✅

Document models, lifecycle transitions, the security model, and the migration that introduced them
are documented in [`docs/DATABASE.md`](DATABASE.md) — Schema Overview, Document Lifecycle, Document
Access & Authorization, and Migrations.

### Implemented Features

**Draft management** — draft creation, draft updates, draft expiration (24-hour staging window, 403
on expired), tenant-isolated draft listing, draft cleanup.

**File storage** — Amazon S3 uploads, SHA-256 checksum generation, file validation, transaction-safe
rollback, secure deletion.

**Publication** — draft publication, initial access policy creation, initial audit record creation,
immutable version creation.

**Version management** — version uploads, version history, current version tracking, presigned
download URLs, old versions retained for historical use.

**Access control** — access control subjects, actions, DENY precedence, temporary access, and policy
mutations are documented in [`docs/DATABASE.md`](DATABASE.md) — Document Access & Authorization.

Implemented: ALLOW / DENY policies, DENY precedence, temporary access (max 7 days), policy updates
(action immutable when editing), policy history, append-only audit log, `authorizeDocumentAction`,
`authorizeQueryDocuments`, current-version validation for query candidates, and `getActiveDocument`
rejecting `EXPIRED` documents with 404.

---

# Query Pipeline

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
| `queryAccessCache.service.js` | authorized candidate cache | Per-access-scope authorized result set |
| `reranking.service.js` | `rerankCandidates` | Score-based reranking |
| `contextGuard.service.js` | `buildSafeContext` | Context sanitization and limits |
| `prompt.service.js` | `buildRAGPrompt` | Secure RAG prompt |
| `evidence.service.js` | `checkEvidenceSufficiency` | Evidence validation |
| `answer.service.js` | `generateQueryAnswer` | Answer generation |
| `answerValidation.service.js` | `validateGeneratedAnswer` | Citation validation |
| `outputGuardrail.service.js` | `validateGeneratedAnswer` | Output safety filtering |
| `llm.service.js` | `generateAnswer` | Bedrock Converse API |
| `queryHistory.service.js` | `getQueryHistory` | Per-user query history read model |

---

# Authorization Flow

Policy resolution rules are documented in [`docs/DATABASE.md`](DATABASE.md) — Document Access &
Authorization. Key points: DENY always wins; expired or inactive policies are rejected;
`isDocumentAccessPolicyActive` enforces `isActive`, `validFrom`, and `validUntil` at authorization
time.

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

`file_name` is the stored original filename and is what the AI service uses to determine the file
type.

The backend owns orchestration, authorization, lifecycle management, and processing state. The AI
service owns content extraction, OCR support (planned), chunk generation, embedding generation, and
vector indexing.

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
POST    /:documentId/versions/:versionId/reprocess
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

`POST /api/v1/auth/login` is protected by `loginRateLimiter` — 5 failed attempts per email, 20 per
IP, 15-minute window. The counter increments on unknown-email and wrong-password responses; a
successful login clears the email counter but not the IP counter. `POST /api/v1/auth/register` is
not rate limited.

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

### `POST /api/v1/query`

Requires JWT authentication. `organization_id` is derived from the authenticated user's
organization context and is not accepted from the request body.

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

> **Known defect:** this is the intended shape, not the shape currently returned. See Blocking
> Defect 1.

Evidence reasons:

```text
SUFFICIENT_EVIDENCE
NO_AUTHORIZED_EVIDENCE
NO_USABLE_EVIDENCE
LOW_RELEVANCE
```

Error responses include validation failures and authentication failures.

### `GET /api/v1/query/history`

Requires JWT authentication and returns only the calling user's entries within their own
organization, newest first. Query parameters are `limit` (1–100, default 20) and `offset` (default
0). Response data:

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

The response does not expose the `organizationId` or `userId` columns.

---

# Phase Overview

## Phase 6 — Document Processing ✅

**Backend infrastructure** — Redis queue integration, BullMQ queue producer
(`documentQueue.service.js`), BullMQ worker (`workers/document.worker.js`, concurrency 1, started by
`server.js`), processing dispatcher, processing retries (3 attempts with exponential backoff,
configured as queue default job options). Dead-letter queue — todo.

**Backend processing services** — `documentLifecycle.service.js`,
`documentProcessingDispatcher.service.js`, `documentProcessing.service.js`,
`documentQueue.service.js`, `documentAI.service.js`, `documentHelpers.js`,
`documentAccess.service.js`.

**Failure handling** — processing failure sets the document to `FAILED` scoped to the current
version, and failed processing can be re-queued through `reprocessDocument`. Failure reason is
logged only; there is no persisted `processingError` column.

**AI service** — FastAPI processing service, document extraction, chunk generation, embedding
generation, Qdrant indexing, multi-tenant organization isolation, processing response handling. OCR
support — planned.

## Phase 7 — Retrieval Infrastructure ✅

**Vector indexing** — Qdrant integration, version-aware indexing, organization-aware payload
indexing, permission-aware retrieval through backend authorization, old document versions retained
in Qdrant. Document re-indexing semantics — pending. Metadata synchronization — not yet needed.

**Retrieval** — vector similarity search, organization filtering, permission-aware retrieval,
score-based reranking. Hybrid retrieval — planned. Metadata filtering — planned.

## Phase 8 — Retrieval-Augmented Generation ✅

Implemented: vector retrieval with candidate multiplier, organization-aware retrieval, tenant-scoped
Redis query cache, document authorization before LLM use, current-version validation, score-based
reranking, evidence sufficiency checks, safe context reconstruction, secure RAG prompt
construction, Bedrock Converse integration with `amazon.nova-pro-v1:0`, source citation validation,
output guardrail filtering, evidence-based LLM fallback.

Planned: streaming responses, hybrid retrieval (BM25 + vector), semantic reranking (cross-encoder).

## Phase 9 — Reliability & Performance ✅

Implemented: version-aware caching, Redis caching, cache invalidation, background cleanup, queue
optimization, retrieval optimization, Redis-backed API rate limiting (query and document upload token
buckets).

- Redis keys use organization ID, topK, and SHA-256 query hash.
- Cached candidates are validated against the document's current version; stale candidates trigger
  fresh AI retrieval; candidates from superseded versions are excluded.
- Authorized candidates are cached separately, keyed by an access-scope fingerprint so two users
  with different permissions never share an entry.
- Access policy changes invalidate the tenant's authorized cache; version changes are handled by
  re-validating on read instead.
- Successful document processing invalidates tenant retrieval cache.
- Processing status updates are scoped to the expected document version.

> All of the above was inert at runtime until 2026-10-04, when `config/redis.js` began exporting a
> connected client instead of a plain options object. See Recent Changes (2026-10-04).

## Phase 10 — Evaluation & Monitoring ⏳

Planned: retrieval evaluation, generation evaluation, queue monitoring, processing latency, AI
service monitoring, cost monitoring, security monitoring.

Query history persistence is now in place, which is the prerequisite for retrieval and generation
evaluation. Analytics endpoints and a history UI are not implemented yet.

## Phase 11 — Deployment ⏳

Planned: Docker, production deployment, logging, observability, health monitoring, scaling.

---

# Backend Structure

```text
backend/
├── prisma/
├── scripts/
│   └── bench-redis.mjs
├── server.js
└── src/
    ├── app.js
    ├── config/
    │   ├── ai.js
    │   ├── bullmq.js
    │   ├── config.js
    │   ├── prisma.js
    │   ├── redis.js
    │   ├── redis-test.js
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
    │   ├── auth.services.js
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
        ├── ApiResponse.js
        ├── asyncHandler.js
        ├── email.js
        ├── fileValidation.js
        ├── jwt.js
        ├── password.js
        └── serializeBigInt.js
```

---

# Migrations

Migration names, purposes, and schema changes are maintained in
[`docs/DATABASE.md`](DATABASE.md) — Migrations and Schema Changes. Ten are currently applied; confirm
with `npx prisma migrate status`.
