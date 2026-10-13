// backend/src/services/metrics/metrics.service.js

import crypto from "crypto";
import config from "../../config/config.js";
import { metricsBuffer } from "./metricsBuffer.service.js";

const ENVIRONMENT = config.app.env || "development";

function generateRequestId() {
    return crypto.randomBytes(16).toString("hex");
}

function hashIdentifier(value) {
    if (!value) return null;
    return crypto.createHash("sha256").update(value).digest("hex").substring(0, 32);
}

function normalizeRoute(path) {
    if (!path) return "unknown";

    return path
        .replace(/\/documents\/[a-f0-9-]{24,}/g, "/documents/:documentId")
        .replace(/\/documents\/drafts\/[a-f0-9-]{24,}/g, "/documents/drafts/:documentId")
        .replace(/\/documents\/versions\/[a-f0-9-]{24,}/g, "/documents/versions/:versionId")
        .replace(/\/organizations\/[a-f0-9-]{24,}/g, "/organizations/:organizationId")
        .replace(/\/units\/[a-f0-9-]{24,}/g, "/units/:unitId")
        .replace(/\/permissions\/[a-f0-9-]{24,}/g, "/permissions/:permissionId")
        .replace(/\/invitations\/[a-f0-9-]{24,}/g, "/invitations/:invitationId")
        .replace(/\/access\/[a-f0-9-]{24,}/g, "/access/:policyId")
        .replace(/\/query\/history\/[a-f0-9-]{24,}/g, "/query/history/:historyId")
        .replace(/\/[a-f0-9-]{24,}(?:\/|$)/g, "/:id/");
}

function getOutcomeFromStatus(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return "SUCCESS";
    if (statusCode === 429) return "RATE_LIMITED";
    if (statusCode >= 400 && statusCode < 500) return "CLIENT_ERROR";
    if (statusCode >= 500) return "SERVER_ERROR";
    return "REJECTED";
}

export function createApiRequestMetric({
    requestId,
    method,
    path,
    statusCode,
    durationMs,
    authenticated = false,
    userId = null,
    organizationId = null,
    responseSizeBytes = null,
    benchmarkRunId = null,
}) {
    return {
        requestId,
        method,
        route: normalizeRoute(path),
        statusCode,
        durationMs,
        outcome: getOutcomeFromStatus(statusCode),
        authenticated,
        userId,
        organizationId,
        responseSizeBytes,
        environment: ENVIRONMENT,
        benchmarkRunId,
    };
}

export function createAuthSecurityEvent({
    eventType,
    outcome,
    reasonCode = null,
    userId = null,
    organizationId = null,
    ip = null,
    email = null,
    metadata = null,
}) {
    return {
        eventType,
        outcome,
        reasonCode,
        userId,
        organizationId,
        ipHash: hashIdentifier(ip),
        emailHash: hashIdentifier(email),
        metadata,
    };
}

export function createQueryPerformanceMetric({
    requestId,
    organizationId,
    userId = null,
    totalDurationMs,
    rawCacheOutcome,
    rawCacheLookupMs = null,
    authorizedCacheOutcome,
    authorizedCacheLookupMs = null,
    authorizedCacheValidationMs = null,
    aiRetrievalMs = null,
    authorizationMs = null,
    rerankingMs = null,
    evidenceEvaluationMs = null,
    contextPreparationMs = null,
    llmGenerationMs = null,
    citationValidationMs = null,
    outputGuardrailMs = null,
    historyPersistenceMs = null,
    usedLLM = false,
    insufficientEvidenceFallback = false,
    finalOutcome,
    errorCategory = null,
}) {
    return {
        requestId,
        organizationId,
        userId,
        totalDurationMs,
        rawCacheOutcome,
        rawCacheLookupMs,
        authorizedCacheOutcome,
        authorizedCacheLookupMs,
        authorizedCacheValidationMs,
        aiRetrievalMs,
        authorizationMs,
        rerankingMs,
        evidenceEvaluationMs,
        contextPreparationMs,
        llmGenerationMs,
        citationValidationMs,
        outputGuardrailMs,
        historyPersistenceMs,
        usedLLM,
        insufficientEvidenceFallback,
        finalOutcome,
        errorCategory,
    };
}

export function createRateLimitMetric({
    route,
    category,
    outcome,
    limitConfig = null,
    rejectionReason = null,
    statusCode = null,
    redisAvailable = true,
    redisError = null,
    userId = null,
    organizationId = null,
}) {
    return {
        route,
        category,
        outcome,
        limitConfig,
        rejectionReason,
        statusCode,
        redisAvailable,
        redisError,
        userId,
        organizationId,
    };
}

export function createBackgroundJobMetric({
    jobId,
    jobType,
    correlationId = null,
    enqueueTimestamp,
    enqueueOutcome,
    queueWaitMs = null,
    processingStartTimestamp = null,
    processingEndTimestamp = null,
    totalProcessingMs = null,
    attempt = 1,
    outcome,
    failureCategory = null,
    organizationId = null,
}) {
    return {
        jobId,
        jobType,
        correlationId,
        enqueueTimestamp,
        enqueueOutcome,
        queueWaitMs,
        processingStartTimestamp,
        processingEndTimestamp,
        totalProcessingMs,
        attempt,
        outcome,
        failureCategory,
        organizationId,
    };
}

export function createDependencyMetric({
    dependency,
    operation,
    durationMs,
    outcome,
    errorCategory = null,
    requestId = null,
    correlationId = null,
}) {
    return {
        dependency,
        operation,
        durationMs,
        outcome,
        errorCategory,
        requestId,
        correlationId,
    };
}

export function createBenchmarkRunMetric({
    runId,
    status = "RUNNING",
    config = {},
    startTime = new Date(),
    endTime = null,
    requestCount = 0,
    errorCount = 0,
    summary = null,
}) {
    return {
        runId,
        status,
        config,
        startTime,
        endTime,
        requestCount,
        errorCount,
        summary,
    };
}

export function recordApiRequest(metric) {
    metricsBuffer.recordApiRequest(metric);
}

export function recordAuthSecurityEvent(metric) {
    metricsBuffer.recordAuthSecurity(metric);
}

export function recordQueryPerformance(metric) {
    metricsBuffer.recordQueryPerformance(metric);
}

export function recordRateLimit(metric) {
    metricsBuffer.recordRateLimit(metric);
}

export function recordBackgroundJob(metric) {
    metricsBuffer.recordBackgroundJob(metric);
}

export function recordDependency(metric) {
    metricsBuffer.recordDependency(metric);
}

export function recordBenchmarkRun(metric) {
    metricsBuffer.recordBenchmarkRun(metric);
}

export {
    generateRequestId,
    hashIdentifier,
    normalizeRoute,
    getOutcomeFromStatus,
    ENVIRONMENT,
};

export default {
    generateRequestId,
    hashIdentifier,
    normalizeRoute,
    getOutcomeFromStatus,
    ENVIRONMENT,
    createApiRequestMetric,
    createAuthSecurityEvent,
    createQueryPerformanceMetric,
    createRateLimitMetric,
    createBackgroundJobMetric,
    createDependencyMetric,
    createBenchmarkRunMetric,
    recordApiRequest,
    recordAuthSecurityEvent,
    recordQueryPerformance,
    recordRateLimit,
    recordBackgroundJob,
    recordDependency,
    recordBenchmarkRun,
};