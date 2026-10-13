// backend/src/services/query/queryAI.service.js
import aiClient from "../../config/ai.js";

export const retrieveFromAI = async (
    query,
    topK = 5,
    organizationId
) => {
    const response = await aiClient.post(
        "/api/v1/retrieve",
        {
            query,
            organization_id: organizationId,
            top_k: topK,
        },
        { timeout: 30000 }
    );

    // AI service now returns chunk_type in results
    return response.data;
};
