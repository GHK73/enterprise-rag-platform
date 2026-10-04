// backend/src/workers/document.worker.js

import { Worker } from "bullmq";

import config from "../config/config.js";
import { bullmqConnection } from "../config/bullmq.js";
import { processDocument } from "../services/document/documentProcessing.service.js";

let documentWorker = null;

if (config.redis.enabled) {
    documentWorker = new Worker(
        "document-processing",
        async (job) => {
            const {
                documentId,
                versionId,
            } = job.data;

            console.log(
                `DOCUMENT WORKER: Processing ${documentId}`
            );

            await processDocument({
                documentId,
                versionId,
            });

            console.log(
                `DOCUMENT WORKER: Completed ${documentId}`
            );
        },
        {
            connection: bullmqConnection,
            concurrency: 1,
        }
    );

    documentWorker.on(
        "ready",
        () => {
            console.log(
                "DOCUMENT WORKER READY"
            );
        }
    );

    documentWorker.on(
        "completed",
        (job) => {
            console.log(
                `DOCUMENT WORKER JOB COMPLETED: ${job.id}`
            );
        }
    );

    documentWorker.on(
        "failed",
        (job, error) => {
            console.error(
                `DOCUMENT WORKER JOB FAILED: ${job?.id}`,
                error
            );
        }
    );

    documentWorker.on(
        "error",
        (error) => {
            console.error(
                "DOCUMENT WORKER ERROR:",
                error.message
            );
        }
    );
}

export default documentWorker;