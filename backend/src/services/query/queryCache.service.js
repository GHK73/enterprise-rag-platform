import { connection } from "../../config/bullmq.js";
import config from "../../config/config.js";

const QUERY_CACHE_TTL = 300;

const buildCacheKey = (
    query,
    topK
) => {
    return [
        "rag:retrieval",
        topK,
        query.trim().toLowerCase(),
    ].join(":");
};

export const getCachedQuery = async (
    query,
    topK
) => {
    if (
        !config.redis.enabled ||
        !connection
    ) {
        return null;
    }

    try {
        const key = buildCacheKey(
            query,
            topK
        );

        const cached =
            await connection.get(key);

        if (!cached) {
            return null;
        }

        return JSON.parse(cached);
    } catch (error) {
        console.error(
            "Redis query cache read failed:",
            error.message
        );

        return null;
    }
};

export const setCachedQuery = async (
    query,
    topK,
    result
) => {
    if (
        !config.redis.enabled ||
        !connection
    ) {
        return;
    }

    try {
        const key = buildCacheKey(
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