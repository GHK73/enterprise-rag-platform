// backend/src/middleware/upload.middleware.js

import multer from "multer";
import ApiError from "../utils/ApiError.js";
import { validateFile } from "../utils/fileValidation.js";

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter(req, file, cb) {
        try {
            validateFile(file);
            cb(null, true);
        } catch (error) {
            cb(error);
        }
    },
});

// Custom error handler for multer file size limit
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return next(new ApiError(413, `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`, "FILE_TOO_LARGE"));
        }
        return next(new ApiError(400, err.message, err.code));
    }
    next(err);
};

export default upload;