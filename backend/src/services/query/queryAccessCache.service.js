import crypto from "crypto";
import config from "../../config/config.js";
import redisConnection from "../../config/redis.js";

const connection = redisConnection;

const QUERY_ACCESS_CACHE_TTL = 300;
const QUERY_ACCESS_CACHE_PREFIX = "rag:authorized-retrieval";

const buildQueryHash = (query) => {
    return crypto
        .createHash("sha256")
        .update(query.trim().toLowerCase())
        .digest("hex");
};

const buildAccessScopeHash = (scope) => {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(scope))
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

export const buildQueryAccessScopeHash = (scope) => {
    return buildAccessScopeHash(scope);
};

export const getCachedAuthorizedQuery = async (
    organizationId,
    accessScopeHash,
    query,
    topK
) => {
    if (!config.redis.enabled || !connection) {
        return null;
    }

    try {
        const key = buildCacheKey(
            organizationId,
            accessScopeHash,
            query,
            topK
        );

        const cached = await connection.get(key);

        if (!cached) {
            return null;
        }

        const result = JSON.parse(cached);

        return Array.isArray(result) ? result : null;
    } catch (error) {
        console.error(
            "Redis authorized query cache read failed:",
            error.message
        );

        return null;
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
    } catch (error) {
        console.error(
            "Redis authorized query cache write failed:",
            error.message
        );
    }
};

export const invalidateOrganizationAuthorizedQueryCache = async (
    organizationId
) => {
    if (
        !config.redis.enabled ||
        !connection ||
        !organizationId
    ) {
        return;
    }

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
    } catch (error) {
        console.error(
            "Redis authorized query cache invalidation failed:",
            error.message
        );
    }
};