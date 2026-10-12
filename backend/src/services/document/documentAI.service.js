import aiClient from "../../config/ai.js";
import { getDownloadUrlFromS3 } from "../s3.service.js";

async function buildProcessingPayload(document, version) {
    const fileUrl = await getDownloadUrlFromS3(
        version.storageKey,
        version.storageBucket
    );

    return {
        document_id: document.id,
        version_id: version.id,
        organization_id: document.organizationId,
        file_url: fileUrl,
        file_name: version.originalFileName,
    };
}


async function processDocumentWithAI(payload) {
    const response = await aiClient.post(
        "/api/v1/process-document",
        payload
    );

    return response.data;
}

async function handleProcessingSuccess(response) {
    return response;
}

export {
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
};
