// backend/src/utils/fileValidation.js

import ApiError from "./ApiError.js";

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const validateFile = (file)=>{
    if(!file){
        throw new ApiError(400,"File is required.");
    }
    if(!ALLOWED_MIME_TYPES.includes(file.mimetype)){
        throw new ApiError(400,"Unsupported file type. Only PDF, TXT, and DOCX files are allowed.")
    }
    return true;
};