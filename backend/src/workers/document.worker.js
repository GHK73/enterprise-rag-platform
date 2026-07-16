// backend/src/workers/document.worker.js

import {Worker} from "bullmq";
import config from "../config/config.js";
import {connection} from "../config/bullmq.js";
import {processDocument} from "../services/document/documentProcessing.service.js";

let documentWorker = null;

function startDocumentWorker(){
    if(!config.redis.enabled) return null;
    if(documentWorker) return documentWorker;

    documentWorker = new Worker(
        "document-processing",
        async(job)=>{
            await processDocument({
                documentId: job.data.documentId,
                versionId: job.data.versionId, 
            });
        },{
            connection,
        }
    );
    documentWorker.on("completed",(job,error)=>{
        console.lot(`Document processing completed: ${job.id}`);
    });
    documentWorker.on("failed",(job,error)=>{
        console.error(`Document processing failed: ${job?.id}`,error);
    });
    return documentWorker;
}

export {startDocumentWorker,};