import { documentProcessingQueue } from "../../config/bullmq.js";
import config from "../../config/config.js";

async function initializeDocumentQueue() {
    if (!config.redis.enabled) return;
    await documentProcessingQueue.waitUntilReady();
}

async function addDocumentProcessingJob({ documentId, versionId }) {
    if (!config.redis.enabled) return null;

    return await documentProcessingQueue.add(
        "process-document",
        {
            documentId,
            versionId,
        },
        {
            jobId: `${documentId}-${versionId}-${Date.now()}`,
        }
    );
}

export {
    initializeDocumentQueue,
    addDocumentProcessingJob,
};
