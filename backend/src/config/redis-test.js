import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new IORedis(process.env.REDIS_URL, {
    protocol: 2,
    tls: {},
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
});

redis.on("connect", () => {
    console.log("CONNECT");
});

redis.on("ready", () => {
    console.log("READY");
});

redis.on("error", (error) => {
    console.error("ERROR:", error.message);
});

redis.on("close", () => {
    console.log("CLOSED");
});

try {
    console.log("PING:", await redis.ping());
} catch (error) {
    console.error("PING FAILED:", error.message);
}

await redis.quit();