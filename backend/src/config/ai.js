// backend/src/config/ai.js

import axios from "axios";
import config from "./config.js";

const aiClient = axios.create({
    baseURL: config.ai.url,
    timeout: 5 * 60 * 1000,
    headers: {
        "Content-Type": "application/json",
    },
});

export const deleteDocumentVectors = async (organizationId, documentId) => {
    try {
        await aiClient.delete(`/api/v1/vectors`, {
            data: {
                organization_id: organizationId,
                document_id: documentId,
            },
            timeout: 30000,
        });
        return { success: true };
    } catch (error) {
        console.error(
            `AI SERVICE: Failed to delete vectors for document ${documentId}:`,
            error.message
        );
        return { success: false, error: error.message };
    }
};

export default aiClient;