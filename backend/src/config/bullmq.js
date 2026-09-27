import IORedis from "ioredis";
import { Queue } from "bullmq";

import config from "./config.js";

let connection = null;
let documentProcessingQueue = null;

if (config.redis.enabled) {
    connection = new IORedis(config.redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
    });

    connection.on("connect", () => {
        console.log("Redis TCP connection established");
    });

    connection.on("ready", () => {
        console.log("Redis connection ready");
    });

    connection.on("error", (error) => {
        console.error("Redis connection error:", error);
    });

    connection.on("close", () => {
        console.log("Redis connection closed");
    });

    documentProcessingQueue = new Queue(
        "document-processing",
        {
            connection,

            defaultJobOptions: {
                attempts: 3,
                removeOnComplete: 1000,
                removeOnFail: 5000,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
            },
        }
    );
}

export {
    connection,
    documentProcessingQueue,
};