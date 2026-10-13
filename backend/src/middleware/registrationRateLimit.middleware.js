import ApiError from "../utils/ApiError.js";

import {
    checkRegistrationRateLimit,
    recordRegistrationAttempt,
} from "../services/authRateLimit.service.js";
import {
    createRateLimitMetric,
    recordRateLimit,
} from "../services/metrics/metrics.service.js";

export const registrationRateLimiter = async (
    req,
    res,
    next
) => {
    try {
        const ip = req.ip;

        if (!ip) {
            return next();
        }

        const result =
            await checkRegistrationRateLimit({
                ip,
            });

        if (!result?.blocked) {
            recordRateLimit(createRateLimitMetric({
                route: req.originalUrl || req.url,
                category: "registration",
                outcome: "ALLOWED",
                redisAvailable: true,
                userId: null,
                organizationId: null,
            }));
            return next();
        }

        const retryAfter =
            Number(result.retryAfter) || 1;

        recordRateLimit(createRateLimitMetric({
            route: req.originalUrl || req.url,
            category: "registration",
            outcome: "REJECTED",
            limitConfig: { ipMaxAttempts: 5, windowSeconds: 900 },
            rejectionReason: result.reason || "RATE_LIMIT_EXCEEDED",
            statusCode: 429,
            redisAvailable: true,
            userId: null,
            organizationId: null,
        }));

        const error = new ApiError(
            429,
            "Too many registration attempts. Please try again later."
        );

        error.retryAfter = retryAfter;

        res.set(
            "Retry-After",
            String(retryAfter)
        );

        return next(error);
    } catch (error) {
        recordRateLimit(createRateLimitMetric({
            route: req.originalUrl || req.url,
            category: "registration",
            outcome: "ERROR",
            redisAvailable: false,
            redisError: error.message,
            userId: null,
            organizationId: null,
        }));
        return next(error);
    }
};
