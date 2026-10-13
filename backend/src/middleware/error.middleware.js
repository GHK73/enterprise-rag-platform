import {
    createAuthSecurityEvent,
    recordAuthSecurityEvent,
} from "../services/metrics/metrics.service.js";

const errorHandler = (
    err,
    req,
    res,
    next
) => {
    let statusCode =
        err.statusCode || 500;

    let message =
        err.message || "Internal Server Error";

    if (err.code === "LIMIT_FILE_SIZE") {
        statusCode = 413;
        message =
            "File too large. Maximum size is 25 MB.";
    }

    const isOperationalError =
        statusCode >= 400 &&
        statusCode < 500;

    if (statusCode === 401) {
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "UNAUTHORIZED",
            outcome: "UNAUTHORIZED",
            reasonCode: err.reasonCode || "AUTHENTICATION_FAILED",
            userId: req.user?.id || null,
            organizationId: req.user?.unit?.organizationId || null,
            ip: req.ip,
            metadata: { message: err.message },
        }));
    } else if (statusCode === 403) {
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "FORBIDDEN",
            outcome: "FORBIDDEN",
            reasonCode: err.reasonCode || "ACCESS_DENIED",
            userId: req.user?.id || null,
            organizationId: req.user?.unit?.organizationId || null,
            ip: req.ip,
            metadata: { message: err.message },
        }));
    } else if (statusCode === 429) {
        recordAuthSecurityEvent(createAuthSecurityEvent({
            eventType: "RATE_LIMIT_REJECTED",
            outcome: "RATE_LIMITED",
            reasonCode: err.reasonCode || "RATE_LIMIT_EXCEEDED",
            userId: req.user?.id || null,
            organizationId: req.user?.unit?.organizationId || null,
            ip: req.ip,
            metadata: { message: err.message, retryAfter: err.retryAfter },
        }));
    }

    const response = {
        success: false,
        message: isOperationalError
            ? message
            : "Internal Server Error",
    };

    if (err.retryAfter) {
        response.retryAfter = err.retryAfter;
    }

    console.error(
        `[ERROR] ${statusCode}: ${message}`,
        err.stack || err
    );

    return res.status(statusCode).json(response);
};

export default errorHandler;