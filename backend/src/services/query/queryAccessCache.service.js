import crypto from "crypto";
import config from "../../config/config.js";
import { redisClient } from "../../config/redis.js";

let metricsModule = null;
try {
    metricsModule = await import("../metrics/metrics.service.js");
} catch {
    // Metrics module not available (e.g., in tests)
}

const { recordDependency, createDependencyMetric } = metricsModule || {};

const connection = redisClient;

const QUERY_ACCESS_CACHE_TTL = 300;
const QUERY_ACCESS_CACHE_PREFIX = "rag:authorized-retrieval";

const buildQueryHash = (query) => {
    return crypto
        .createHash("sha256")
        .update(query.trim().toLowerCase())
        .digest("hex");
};

const buildCacheKey = (
    organizationId,
    accessScopeHash,
    query,
    topK
) => {
    return [
        QUERY_ACCESS_CACHE_PREFIX,
        organizationId,
        accessScopeHash,
        topK,
        buildQueryHash(query),
    ].join(":");
};

function recordMetric(dependency, operation, durationMs, outcome, errorCategory = null) {
    if (recordDependency && createDependencyMetric) {
        recordDependency(createDependencyMetric({
            dependency,
            operation,
            durationMs,
            outcome,
            errorCategory,
        }));
    }
}

export const getCachedAuthorizedQuery = async (
    organizationId,
    accessScopeHash,
    query,
    topK
) => {
    if (!config.redis.enabled || !connection) {
        return { data: null, outcome: "BYPASS", lookupMs: 0 };
    }

    const startTime = process.hrtime.bigint();

    try {
        const key = buildCacheKey(
            organizationId,
            accessScopeHash,
            query,
            topK
        );

        const cached = await connection.get(key);

        const endTime = process.hrtime.bigint();
        const lookupMs = Number(endTime - startTime) / 1_000_000;

        if (!cached) {
            recordMetric("redis", "authorized_query_cache_get", Math.round(lookupMs), "MISS");
            return { data: null, outcome: "MISS", lookupMs: Math.round(lookupMs) };
        }

        const result = JSON.parse(cached);

        recordMetric("redis", "authorized_query_cache_get", Math.round(lookupMs), "HIT");

        return { data: Array.isArray(result) ? result : null, outcome: "HIT", lookupMs: Math.round(lookupMs) };
    } catch (error) {
        const endTime = process.hrtime.bigint();
        const lookupMs = Number(endTime - startTime) / 1_000_000;

        console.error(
            "Redis authorized query cache read failed:",
            error.message
        );

        recordMetric("redis", "authorized_query_cache_get", Math.round(lookupMs), "ERROR", error.message);

        return { data: null, outcome: "ERROR", lookupMs: Math.round(lookupMs) };
    }
};

export const setCachedAuthorizedQuery = async (
    organizationId,
    accessScopeHash,
    query,
    topK,
    result
) => {
    if (!config.redis.enabled || !connection) {
        return;
    }

    const startTime = process.hrtime.bigint();

    try {
        const key = buildCacheKey(
            organizationId,
            accessScopeHash,
            query,
            topK
        );

        await connection.set(
            key,
            JSON.stringify(result),
            "EX",
            QUERY_ACCESS_CACHE_TTL
        );

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        recordMetric("redis", "authorized_query_cache_set", Math.round(durationMs), "SUCCESS");
    } catch (error) {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        console.error(
            "Redis authorized query cache write failed:",
            error.message
        );

        recordMetric("redis", "authorized_query_cache_set", Math.round(durationMs), "ERROR", error.message);
    }
};

export const invalidateOrganizationAuthorizedQueryCache = async (
    organizationId
) => {
    if (!organizationId) {
        return;
    }

    if (!config.redis.enabled || !connection) {
        return;
    }

    const startTime = process.hrtime.bigint();

    try {
        const pattern = `${QUERY_ACCESS_CACHE_PREFIX}:${organizationId}:*`;

        let cursor = "0";

        do {
            const result = await connection.scan(
                cursor,
                "MATCH",
                pattern,
                "COUNT",
                100
            );

            cursor = result[0];

            const keys = result[1];

            if (keys.length > 0) {
                await connection.del(...keys);
            }
        } while (cursor !== "0");

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        recordMetric("redis", "authorized_query_cache_invalidate", Math.round(durationMs), "SUCCESS");
    } catch (error) {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        console.error(
            "Redis authorized query cache invalidation failed:",
            error.message
        );

        recordMetric("redis", "authorized_query_cache_invalidate", Math.round(durationMs), "ERROR", error.message);
    }
};
