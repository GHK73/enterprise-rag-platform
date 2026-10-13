// src/utils/ApiError.js

class ApiError extends Error {
    constructor(statusCode, message, reasonCode = null) {
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        this.reasonCode = reasonCode;

        Error.captureStackTrace(this, this.constructor);
    }
}

export default ApiError;