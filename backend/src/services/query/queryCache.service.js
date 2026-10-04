import crypto from "crypto";
import config from "../../config/config.js";
import { redisClient } from "../../config/redis.js";

const connection = redisClient;

const QUERY_CACHE_TTL = 300;
const QUERY_CACHE_PREFIX = "rag:retrieval";

const buildCacheKey = (organizationId, query, topK) => {
    const queryHash = crypto
        .createHash("sha256")
        .update(query.trim().toLowerCase())
        .digest("hex");

    return [
        QUERY_CACHE_PREFIX,
        organizationId,
        topK,
        queryHash,
    ].join(":");
};

export const getCachedQuery = async (
    organizationId,
    query,
    topK
) => {
    if (!config.redis.enabled || !connection) {
        return null;
    }

    try {
        const key = buildCacheKey(
            organizationId,
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
            "Redis query cache read failed:",
            error.message
        );

        return null;
    }
};

export const setCachedQuery = async (
    organizationId,
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
            query,
            topK
        );

        await connection.set(
            key,
            JSON.stringify(result),
            "EX",
            QUERY_CACHE_TTL
        );
    } catch (error) {
        console.error(
            "Redis query cache write failed:",
            error.message
        );
    }
};

export const invalidateOrganizationQueryCache = async (
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
        const pattern = `${QUERY_CACHE_PREFIX}:${organizationId}:*`;

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
            "Redis query cache invalidation failed:",
            error.message
        );
    }
};
