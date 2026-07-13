// backend/src/utils/fileValidation.js

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const validateFile = (file)=>{
    if(!file){
        throw new Error("File is required.");
    }
    if(!ALLOWED_MIME_TYPES.includes(file.mimetype)){
        throw new Error("Unsuppoted file type.")
    }
    return true;
};