import axios from "axios";
import config from "../../config/config.js";

export const retrieveFromAI = async (query, topK = 5) => {
    const response = await axios.post(
        `${config.ai.url}/api/v1/retrieve`,
        {
            query,
            top_k: topK,
        },
        {
            timeout: 30000,
        }
    );

    return response.data;
};