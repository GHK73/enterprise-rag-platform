// backend/src/config/bullmq.js

import IORedis from "ioredis";
import { Queue } from "bullmq";

import config from "./config.js";

let connection = null;
let documentProcessingQueue = null;

if (config.redis.enabled) {
    connection = new IORedis(config.redis.url, {
        maxRetriesPerRequest: null,
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