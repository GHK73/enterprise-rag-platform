const errorHandler = (
    err,
    req,
    res,
    next
) => {
    const statusCode =
        err.statusCode || 500;

    const isOperationalError =
        statusCode >= 400 &&
        statusCode < 500;

    return res.status(statusCode).json({
        success: false,
        message: isOperationalError
            ? err.message
            : "Internal Server Error",
    });
};

export default errorHandler;