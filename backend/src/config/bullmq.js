import { Queue } from "bullmq";

import config from "./config.js";
import redisConnection from "./redis.js";

let bullmqConnection = null;
let documentProcessingQueue = null;

if (config.redis.enabled) {
    bullmqConnection = {
        ...redisConnection,
        maxRetriesPerRequest: null,
        // Align with main Redis client: disable offline queue for consistent behavior
        enableOfflineQueue: false,
    };

    documentProcessingQueue = new Queue(
        "document-processing",
        {
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
        }
    );

    documentProcessingQueue.on(
        "error",
        (error) => {
            console.error(
                "BULLMQ QUEUE ERROR:",
                error.message
            );
        }
    );

    documentProcessingQueue.on(
        "ready",
        () => {
            console.log(
                "BULLMQ QUEUE READY"
            );
        }
    );
}

export {
    bullmqConnection,
    documentProcessingQueue,
};