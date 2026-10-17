import Redis from "ioredis";
import config from "./config.js";

const redisUrl = config.redis.enabled
    ? process.env.REDIS_URL
    : undefined;
const parsedRedisUrl = redisUrl ? new URL(redisUrl) : null;

if (
    parsedRedisUrl &&
    !["redis:", "rediss:"].includes(parsedRedisUrl.protocol)
) {
    throw new Error("REDIS_URL must use the redis:// or rediss:// protocol");
}

if (parsedRedisUrl && !parsedRedisUrl.hostname) {
    throw new Error("REDIS_URL must include a Redis host");
}

const redisHost = parsedRedisUrl?.hostname || config.redis.host;
const redisTlsEnabled =
    config.redis.tls || parsedRedisUrl?.protocol === "rediss:";
const redisDatabase = parsedRedisUrl?.pathname.slice(1);

if (redisDatabase && !/^\d+$/.test(redisDatabase)) {
    throw new Error("REDIS_URL database path must be a non-negative integer");
}

const redisConnection = {
    host: redisHost,
    port: Number(
        parsedRedisUrl
            ? parsedRedisUrl.port || 6379
            : config.redis.port
    ),
    username: parsedRedisUrl
        ? decodeURIComponent(parsedRedisUrl.username)
        : config.redis.username,
    password: parsedRedisUrl
        ? decodeURIComponent(parsedRedisUrl.password)
        : config.redis.password,
    db: redisDatabase ? Number(redisDatabase) : undefined,
    tls: redisTlsEnabled
        ? {
              rejectUnauthorized: false,
              servername: redisHost,
          }
        : undefined,
    maxRetriesPerRequest: 10,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 30000,
    keepAlive: 30000,
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 500, 3000),
};

const redisClient = config.redis.enabled ? new Redis(redisConnection) : null;

if (redisClient) {
    console.log("Redis is enabled; connecting to the configured Redis server");

    redisClient.on("connect", () => {
        console.log("Redis client connected");
    });

    redisClient.on("ready", () => {
        console.log("Redis client ready");
    });

    redisClient.on("error", (error) => {
        console.error("Redis client error:", error.message);
    });

    redisClient.on("close", () => {
        console.warn("Redis client connection closed");
    });
} else {
    console.log("Redis is disabled; Redis-backed caches and queues will be bypassed");
}

export { redisConnection, redisClient };
export default redisConnection;
