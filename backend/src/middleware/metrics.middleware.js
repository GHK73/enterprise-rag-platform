// backend/src/middleware/metrics.middleware.js

import { generateRequestId, createApiRequestMetric, recordApiRequest } from "../services/metrics/metrics.service.js";

export const requestMetricsMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const requestId = generateRequestId();
    let responseSizeBytes = null;

    // Attach requestId to request and response for tracing
    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    req.metrics = {
        requestId,
        startTime,
        rawCacheOutcome: null,
        authorizedCacheOutcome: null,
    };

    const originalSend = res.send;
    res.send = function (body) {
        if (body && typeof body === "string") {
            responseSizeBytes = Buffer.byteLength(body, "utf8");
        } else if (body && typeof body === "object") {
            try {
                responseSizeBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
            } catch {
                responseSizeBytes = null;
            }
        }

        return originalSend.call(this, body);
    };

    // `finish` covers send(), end(), HEAD responses, and other completed
    // response paths. Recording before send() also missed the final status
    // code when downstream middleware changed it while ending the response.
    res.once("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        const authenticated = !!req.user?.id;
        const userId = req.user?.id || null;
        const organizationId = req.user?.unit?.organizationId || null;

        const metric = createApiRequestMetric({
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: Math.max(1, Math.round(durationMs)),
            rawCacheOutcome: req.metrics.rawCacheOutcome,
            authorizedCacheOutcome: req.metrics.authorizedCacheOutcome,
            authenticated,
            userId,
            organizationId,
            responseSizeBytes,
        });

        try {
            recordApiRequest(metric);
        } catch (error) {
            console.error("METRICS: Failed to record API request:", error.message);
        }
    });

    next();
};

export default requestMetricsMiddleware;
