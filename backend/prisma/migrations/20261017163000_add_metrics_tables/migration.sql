CREATE TYPE "ApiRequestOutcome" AS ENUM (
    'SUCCESS',
    'CLIENT_ERROR',
    'SERVER_ERROR',
    'RATE_LIMITED',
    'REJECTED'
);

CREATE TYPE "AuthEventType" AS ENUM (
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'REGISTRATION_SUCCESS',
    'REGISTRATION_FAILED',
    'JWT_INVALID',
    'JWT_EXPIRED',
    'ACCOUNT_INACTIVE',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'PERMISSION_DENIED',
    'RATE_LIMIT_REJECTED',
    'DEPENDENCY_FAILURE'
);

CREATE TYPE "CacheOutcome" AS ENUM (
    'HIT',
    'MISS',
    'BYPASS',
    'ERROR'
);

CREATE TYPE "JobOutcome" AS ENUM (
    'SUCCESS',
    'FAILURE',
    'RETRY'
);

CREATE TYPE "BenchmarkStatus" AS ENUM (
    'RUNNING',
    'COMPLETED',
    'FAILED'
);

CREATE TABLE "ApiRequestMetric" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" VARCHAR(64) NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "outcome" "ApiRequestOutcome" NOT NULL,
    "authenticated" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "organizationId" TEXT,
    "responseSizeBytes" INTEGER,
    "environment" TEXT,
    "benchmarkRunId" TEXT,
    CONSTRAINT "ApiRequestMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSecurityEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" "AuthEventType" NOT NULL,
    "outcome" TEXT NOT NULL,
    "reasonCode" TEXT,
    "userId" TEXT,
    "organizationId" TEXT,
    "ipHash" TEXT,
    "emailHash" TEXT,
    "metadata" JSONB,
    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueryPerformanceMetric" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" VARCHAR(64) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "totalDurationMs" INTEGER NOT NULL,
    "rawCacheOutcome" "CacheOutcome" NOT NULL,
    "rawCacheLookupMs" INTEGER,
    "authorizedCacheOutcome" "CacheOutcome" NOT NULL,
    "authorizedCacheLookupMs" INTEGER,
    "authorizedCacheValidationMs" INTEGER,
    "aiRetrievalMs" INTEGER,
    "authorizationMs" INTEGER,
    "rerankingMs" INTEGER,
    "evidenceEvaluationMs" INTEGER,
    "contextPreparationMs" INTEGER,
    "llmGenerationMs" INTEGER,
    "citationValidationMs" INTEGER,
    "outputGuardrailMs" INTEGER,
    "historyPersistenceMs" INTEGER,
    "usedLLM" BOOLEAN NOT NULL DEFAULT false,
    "insufficientEvidenceFallback" BOOLEAN NOT NULL DEFAULT false,
    "finalOutcome" TEXT NOT NULL,
    "errorCategory" TEXT,
    CONSTRAINT "QueryPerformanceMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitMetric" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "route" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "limitConfig" JSONB,
    "rejectionReason" TEXT,
    "statusCode" INTEGER,
    "redisAvailable" BOOLEAN NOT NULL,
    "redisError" TEXT,
    "userId" TEXT,
    "organizationId" TEXT,
    CONSTRAINT "RateLimitMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackgroundJobMetric" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" VARCHAR(64) NOT NULL,
    "jobType" TEXT NOT NULL,
    "correlationId" TEXT,
    "enqueueTimestamp" TIMESTAMP(3) NOT NULL,
    "enqueueOutcome" TEXT NOT NULL,
    "queueWaitMs" INTEGER,
    "processingStartTimestamp" TIMESTAMP(3),
    "processingEndTimestamp" TIMESTAMP(3),
    "totalProcessingMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "outcome" "JobOutcome" NOT NULL,
    "failureCategory" TEXT,
    "organizationId" TEXT,
    CONSTRAINT "BackgroundJobMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DependencyMetric" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dependency" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "errorCategory" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    CONSTRAINT "DependencyMetric_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "BenchmarkStatus" NOT NULL DEFAULT 'RUNNING',
    "config" JSONB NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiRequestMetric_timestamp_idx" ON "ApiRequestMetric"("timestamp");
CREATE INDEX "ApiRequestMetric_route_idx" ON "ApiRequestMetric"("route");
CREATE INDEX "ApiRequestMetric_statusCode_idx" ON "ApiRequestMetric"("statusCode");
CREATE INDEX "ApiRequestMetric_outcome_idx" ON "ApiRequestMetric"("outcome");
CREATE INDEX "ApiRequestMetric_userId_idx" ON "ApiRequestMetric"("userId");
CREATE INDEX "ApiRequestMetric_organizationId_idx" ON "ApiRequestMetric"("organizationId");
CREATE INDEX "ApiRequestMetric_benchmarkRunId_idx" ON "ApiRequestMetric"("benchmarkRunId");

CREATE INDEX "AuthSecurityEvent_timestamp_idx" ON "AuthSecurityEvent"("timestamp");
CREATE INDEX "AuthSecurityEvent_eventType_idx" ON "AuthSecurityEvent"("eventType");
CREATE INDEX "AuthSecurityEvent_userId_idx" ON "AuthSecurityEvent"("userId");
CREATE INDEX "AuthSecurityEvent_organizationId_idx" ON "AuthSecurityEvent"("organizationId");
CREATE INDEX "AuthSecurityEvent_ipHash_idx" ON "AuthSecurityEvent"("ipHash");
CREATE INDEX "AuthSecurityEvent_emailHash_idx" ON "AuthSecurityEvent"("emailHash");

CREATE INDEX "QueryPerformanceMetric_timestamp_idx" ON "QueryPerformanceMetric"("timestamp");
CREATE INDEX "QueryPerformanceMetric_requestId_idx" ON "QueryPerformanceMetric"("requestId");
CREATE INDEX "QueryPerformanceMetric_organizationId_idx" ON "QueryPerformanceMetric"("organizationId");
CREATE INDEX "QueryPerformanceMetric_userId_idx" ON "QueryPerformanceMetric"("userId");
CREATE INDEX "QueryPerformanceMetric_rawCacheOutcome_idx" ON "QueryPerformanceMetric"("rawCacheOutcome");
CREATE INDEX "QueryPerformanceMetric_authorizedCacheOutcome_idx" ON "QueryPerformanceMetric"("authorizedCacheOutcome");

CREATE INDEX "RateLimitMetric_timestamp_idx" ON "RateLimitMetric"("timestamp");
CREATE INDEX "RateLimitMetric_route_idx" ON "RateLimitMetric"("route");
CREATE INDEX "RateLimitMetric_category_idx" ON "RateLimitMetric"("category");
CREATE INDEX "RateLimitMetric_outcome_idx" ON "RateLimitMetric"("outcome");
CREATE INDEX "RateLimitMetric_userId_idx" ON "RateLimitMetric"("userId");
CREATE INDEX "RateLimitMetric_organizationId_idx" ON "RateLimitMetric"("organizationId");

CREATE INDEX "BackgroundJobMetric_timestamp_idx" ON "BackgroundJobMetric"("timestamp");
CREATE INDEX "BackgroundJobMetric_jobId_idx" ON "BackgroundJobMetric"("jobId");
CREATE INDEX "BackgroundJobMetric_jobType_idx" ON "BackgroundJobMetric"("jobType");
CREATE INDEX "BackgroundJobMetric_outcome_idx" ON "BackgroundJobMetric"("outcome");
CREATE INDEX "BackgroundJobMetric_organizationId_idx" ON "BackgroundJobMetric"("organizationId");
CREATE INDEX "BackgroundJobMetric_correlationId_idx" ON "BackgroundJobMetric"("correlationId");

CREATE INDEX "DependencyMetric_timestamp_idx" ON "DependencyMetric"("timestamp");
CREATE INDEX "DependencyMetric_dependency_idx" ON "DependencyMetric"("dependency");
CREATE INDEX "DependencyMetric_operation_idx" ON "DependencyMetric"("operation");
CREATE INDEX "DependencyMetric_outcome_idx" ON "DependencyMetric"("outcome");
CREATE INDEX "DependencyMetric_requestId_idx" ON "DependencyMetric"("requestId");
CREATE INDEX "DependencyMetric_correlationId_idx" ON "DependencyMetric"("correlationId");

CREATE UNIQUE INDEX "BenchmarkRun_runId_key" ON "BenchmarkRun"("runId");
CREATE INDEX "BenchmarkRun_runId_idx" ON "BenchmarkRun"("runId");
CREATE INDEX "BenchmarkRun_status_idx" ON "BenchmarkRun"("status");
CREATE INDEX "BenchmarkRun_startTime_idx" ON "BenchmarkRun"("startTime");
