// backend/src/middleware/rateLimit.middleware.js
import Redis from "ioredis";

import config from "../config/config.js";
import redisConnection from "../config/redis.js";
import ApiError from "../utils/ApiError.js";

let redis = null;

if (config.redis.enabled) {
    redis = new Redis(redisConnection);

    redis.on("connect", () => {
        console.log("RATE LIMIT REDIS CONNECTED");
    });

    redis.on("ready", () => {
        console.log("RATE LIMIT REDIS READY");
    });

    redis.on("error", (error) => {
        console.error(
            "RATE LIMIT REDIS ERROR:",
            error.message
        );
    });

    redis.on("close", () => {
        console.log("RATE LIMIT REDIS CLOSED");
    });
}

/*
 * Token bucket implemented atomically in Redis.
 *
 * KEYS[1] = bucket key
 *
 * ARGV[1] = current timestamp in milliseconds
 * ARGV[2] = bucket capacity
 * ARGV[3] = refill rate per second
 * ARGV[4] = token cost
 */

const tokenBucketScript = `
local key = KEYS[1]

local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call(
    "HMGET",
    key,
    "tokens",
    "timestamp"
)

local tokens = tonumber(data[1])
local timestamp = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    timestamp = now
end

local elapsed = math.max(
    0,
    now - timestamp
)

local refill =
    (elapsed / 1000) * refillRate

tokens = math.min(
    capacity,
    tokens + refill
)

local allowed = 0
local retryAfter = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local missing =
        requested - tokens

    retryAfter =
        math.ceil(
            missing / refillRate
        )
end

redis.call(
    "HMSET",
    key,
    "tokens",
    tokens,
    "timestamp",
    now
)

redis.call(
    "EXPIRE",
    key,
    math.ceil(
        (capacity / refillRate) * 2
    )
)

return {
    allowed,
    tokens,
    retryAfter
}
`;

if (redis) {
    redis.defineCommand(
        "consumeToken",
        {
            numberOfKeys: 1,
            lua: tokenBucketScript,
        }
    );
}

const createRateLimiter = ({
    keyPrefix,
    capacity,
    refillRate,
    refillIntervalSeconds,
}) => {
    const refillRatePerSecond =
        refillRate /
        refillIntervalSeconds;

    return async (req, _, next) => {
        if (
            !config.redis.enabled ||
            !redis
        ) {
            return next();
        }

        const userId = req.user?.id;

        if (!userId) {
            throw new ApiError(
                401,
                "Authenticated user is required"
            );
        }

        const key =
            `rate-limit:${keyPrefix}:user:${userId}`;

        try {
            const result =
                await redis.consumeToken(
                    key,
                    Date.now(),
                    capacity,
                    refillRatePerSecond,
                    1
                );

            const [
                allowed,
                ,
                retryAfter,
            ] = result;

            if (Number(allowed) !== 1) {
                const error =
                    new ApiError(
                        429,
                        "Too many requests. Please try again later."
                    );

                error.retryAfter =
                    Number(retryAfter);

                throw error;
            }

            next();
        }
        catch (error) {
            if (
                error instanceof ApiError &&
                error.statusCode === 429
            ) {
                throw error;
            }

            console.error(
                "RATE LIMIT CHECK FAILED:",
                error.message
            );

            /*
             * Fail open if Redis is unavailable.
             * This prevents a Redis outage from
             * taking down the API.
             */
            next();
        }
    };
};

const queryRateLimiter =
    createRateLimiter({
        keyPrefix: "query",
        ...config.rateLimit.query,
    });

const documentUploadRateLimiter =
    createRateLimiter({
        keyPrefix: "document-upload",
        ...config.rateLimit.documentUpload,
    });

export {
    queryRateLimiter,
    documentUploadRateLimiter,
};
