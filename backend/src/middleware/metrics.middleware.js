// backend/src/middleware/metrics.middleware.js

import { generateRequestId, createApiRequestMetric, recordApiRequest } from "../services/metrics/metrics.service.js";

export const requestMetricsMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    const requestId = generateRequestId();

    // Attach requestId to request and response for tracing
    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    req.metrics = {
        requestId,
        startTime,
    };

    const originalSend = res.send;
    res.send = function (body) {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        const authenticated = !!req.user?.id;
        const userId = req.user?.id || null;
        const organizationId = req.user?.unit?.organizationId || null;

        let responseSizeBytes = null;
        if (body && typeof body === "string") {
            responseSizeBytes = Buffer.byteLength(body, "utf8");
        } else if (body && typeof body === "object") {
            try {
                responseSizeBytes = Buffer.byteLength(JSON.stringify(body), "utf8");
            } catch {
                responseSizeBytes = null;
            }
        }

        const metric = createApiRequestMetric({
            requestId,
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs),
            authenticated,
            userId,
            organizationId,
            responseSizeBytes,
        });

        recordApiRequest(metric);

        return originalSend.call(this, body);
    };

    next();
};

export default requestMetricsMiddleware;