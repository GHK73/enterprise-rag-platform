// backend/src/services/document/documentAI.service.js

import axios from "axios";
import config from "../../config/config.js";

async function buildProcessingPayload(document,version){
    return {
        documentId:document.id,
        versionId:version.id,

        organizationId:document.organizationId,
        classification:document.classification,

        storage:{
            bucket:version.storageBucket,
            key:version.storageKey,
        },
    };
}

async function processDocumentWithAI(document,version){
    const payload =
        await buildProcessingPayload(
            document,
            version
        );

    const response = await axios.post(
        `${config.ai.url}/process-document`,
        payload
    );

    return response.data;
}

async function handleProcessingSuccess(response){
    return response;
}

async function handleProcessingFailure(error){
    throw error;
}

export{
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
    handleProcessingFailure,
};