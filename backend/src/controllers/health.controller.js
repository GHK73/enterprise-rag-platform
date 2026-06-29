// backend/src/controllers/health.controller.js

import ApiResponse from "../utils/ApiResponse.js";

const healthCheck = async(req,res)=>{
    return res.status(200).json(
        new ApiResponse(
            200,
            "RAG Backend is running"
        )
    );
};

export default healthCheck;