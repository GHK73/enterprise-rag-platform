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