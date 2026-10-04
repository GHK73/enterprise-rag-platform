import Redis from "ioredis";
import config from "./config.js";

const redisConnection = {
    host: config.redis.host,
    port: config.redis.port,
    username: config.redis.username,
    password: config.redis.password,

    tls: {
        rejectUnauthorized: false,
        servername: config.redis.host,
    },

    maxRetriesPerRequest: 10,
    enableReadyCheck: true,
    lazyConnect: false,

    connectTimeout: 10000,
    commandTimeout: 10000,

    keepAlive: 10000,

    retryStrategy: (times) => {
        return Math.min(times * 500, 5000);
    },

    reconnectOnError: (err) => {
        const targetErrors = [
            "ECONNRESET",
            "ETIMEDOUT",
            "ECONNREFUSED",
            "EHOSTUNREACH",
        ];

        return targetErrors.some((errorCode) =>
            err.message.includes(errorCode)
        );
    },
};

const redisClient = config.redis.enabled
    ? new Redis(redisConnection)
    : null;

if (redisClient) {
    redisClient.on("connect", () => {
        console.log("Redis client connected");
    });

    redisClient.on("ready", () => {
        console.log("Redis client ready");
    });

    redisClient.on("error", (error) => {
        console.error(
            "Redis client error:",
            error.message
        );
    });

    redisClient.on("close", () => {
        console.warn("Redis client connection closed");
    });
}

export {
    redisConnection,
    redisClient,
};

export default redisConnection;
