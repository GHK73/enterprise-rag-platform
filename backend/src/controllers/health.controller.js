// backend/src/controllers/health.controller.js

export const healthCheck = async(req, res)=>{
    res.status(200).json({
        success:true,
        message:"RAG Backend is running",
    });
};