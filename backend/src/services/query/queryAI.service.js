// backend/src/services/query/queryAI.service.js
import axios from "axios";
import config from "../../config/config.js";

export const retrieveFromAI = async (
    query,
    topK = 5,
    organizationId
) => {
    const response = await axios.post(
        `${config.ai.url}/api/v1/retrieve`,
        {
            query,
            organization_id: organizationId,
            top_k: topK,
        },
        { timeout: 30000 }
    );

    return response.data;
};