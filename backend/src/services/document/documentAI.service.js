import axios from "axios";

import config from "../../config/config.js";
import { getDownloadUrlFromS3 } from "../s3.service.js";

async function buildProcessingPayload(document, version) {
    const fileUrl = await getDownloadUrlFromS3(version.storageKey);

    return {
        document_id: document.id,
        version_id: version.id,
        file_url: fileUrl,
    };
}

async function processDocumentWithAI(payload) {
    const response = await axios.post(
        `${config.ai.url}/process-document`,
        payload
    );

    return response.data;
}

async function handleProcessingSuccess(response) {
    return response;
}

async function handleProcessingFailure(error) {
    throw error;
}

export {
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
    handleProcessingFailure,
};