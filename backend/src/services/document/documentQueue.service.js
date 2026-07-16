// backend/src/services/document/documentQueue.service.js

import {documentProcessingQueue} from "../../config/bullmq.js";
import config from "../../config/config.js";

async function initializeDocumentQueue(){
    if(!config.redis.enabled) return;
    await documentProcessingQueue.waitUntilReady();
}

async function addDocumentProcessingJob({documentId, versionId}){
    if(!config.redis.enabled)return null;
    return await documentProcessingQueue.add("process-document",{
            documentId,
            versionId,
        },{
            jobId: `${documentId}:${versionId}`,
        }
    );
}

async function getProcessingJOb(jobId){
    if(!config.redis.enabled) return null;
    return await documentProcessingQueue.getJob(jonId);
}

async function removeProcessingJob(jobId){
    if(!config.redis.enabled) return;
    const job = await documentProcessingQueue.getJob(jobId);
    if(!job)return;
    await job.remove();
}

export{
    initializeDocumentQueue,
    addDocumentProcessingJob,
    getProcessingJOb,
    removeProcessingJob,
};