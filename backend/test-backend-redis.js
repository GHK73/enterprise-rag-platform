import Redis from "ioredis";
import config from "./src/config/config.js";

console.log("Redis config:", {
    enabled: config.redis.enabled,
    host: config.redis.host,
    port: config.redis.port,
    username: config.redis.username,
    passwordLoaded: Boolean(config.redis.password),
    passwordLength: config.redis.password?.length,
});

const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    username: config.redis.username,
    password: config.redis.password,
    tls: {},
});

redis.on("connect", () => {
    console.log("CONNECT");
});

redis.on("ready", async () => {
    console.log("READY");

    try {
        console.log("PING:", await redis.ping());
    } catch (error) {
        console.error("PING ERROR:", error);
    }

    await redis.quit();
});

redis.on("error", (error) => {
    console.error("ERROR:", error);
});