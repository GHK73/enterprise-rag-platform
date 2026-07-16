// backend/src/services/document/documentProcessingDispatcher.service.js

import config from "../../config/config.js";
import {addDocumentProcessingJob} from "./documentQueue.service.js";
import {processDocument,} from "./documentProcessing.service.js";

async function dispatchDocumentProcessing({documentId, versionId}){
    if(config.redis.enabled){
        return await addDocumentProcessingJob({documentId, versionId});
    }
    return await processDocument({documentId,versionId});
}

export {dispatchDocumentProcessing,};