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
    console.info(
        `AI SERVICE: Sending document ${payload.document_id} version ${payload.version_id} for processing.`
    );

    try {
        const response = await aiClient.post(
            "/api/v1/process-document",
            payload
        );

        return response.data;
    } catch (error) {
        console.error(
            `AI SERVICE: Processing request failed for document ${payload.document_id} version ${payload.version_id}; status=${error.response?.status ?? "no response"}, code=${error.code ?? "unknown"}, message=${error.message}`
        );
        throw error;
    }
}

async function handleProcessingSuccess(
    response,
    { documentId, versionId }
) {
    if (
        response?.success !== true ||
        response.document_id !== documentId ||
        response.version_id !== versionId
    ) {
        throw new Error(
            `AI service returned an invalid processing response for document ${documentId} version ${versionId}.`
        );
    }

    console.info(
        `AI SERVICE: Processing completed for document ${documentId} version ${versionId}.`
    );
    return response;
}

export {
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
};
