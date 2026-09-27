import { Queue } from "bullmq";
import config from "./config.js";

let connection = null;
let bullmqConnection = null;
let documentProcessingQueue = null;

if (config.redis.enabled) {
    bullmqConnection = {
        host: config.redis.host,
        port: config.redis.port,
        username: config.redis.username,
        password: config.redis.password,
        tls: {
            rejectUnauthorized: false,
            servername: config.redis.host,
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryStrategy: (times) => {
            if (times > 10) {
                return null;
            }
            return Math.min(times * 200, 5000);
        },
        reconnectOnError: (err) => {
            const targetErrors = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH"];
            return targetErrors.some((e) => err.message.includes(e));
        },
    };

    documentProcessingQueue = new Queue("document-processing", {
        connection: bullmqConnection,
        defaultJobOptions: {
            attempts: 3,
            removeOnComplete: 1000,
            removeOnFail: 5000,
            backoff: {
                type: "exponential",
                delay: 5000,
            },
        },
    });

    documentProcessingQueue.on("error", (error) => {
        console.error("BULLMQ QUEUE ERROR:", error.message);
    });

    documentProcessingQueue.on("ready", () => {
        console.log("BULLMQ QUEUE READY");
    });
}

export {
    connection,
    bullmqConnection,
    documentProcessingQueue,
};