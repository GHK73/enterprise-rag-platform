import ApiError from "../utils/ApiError.js";

import {
    checkLoginRateLimit,
} from "../services/authRateLimit.service.js";
import {
    createRateLimitMetric,
    recordRateLimit,
} from "../services/metrics/metrics.service.js";

export const loginRateLimiter = async (
    req,
    res,
    next
) => {
    try {
        const email =
            typeof req.body?.email === "string"
                ? req.body.email
                    .trim()
                    .toLowerCase()
                : "";

        const ip = req.ip;

        if (!ip) {
            return next();
        }

        const result =
            await checkLoginRateLimit({
                email,
                ip,
            });

        if (!result?.blocked) {
            recordRateLimit(createRateLimitMetric({
                route: req.originalUrl || req.url,
                category: "login",
                outcome: result?.bypassed
                    ? "BYPASS"
                    : result?.redisAvailable
                        ? "ALLOWED"
                        : "ERROR",
                redisAvailable: result?.redisAvailable ?? false,
                userId: null,
                organizationId: null,
            }));
            return next();
        }

        const retryAfter =
            Number(result.retryAfter) || 1;

        recordRateLimit(createRateLimitMetric({
            route: req.originalUrl || req.url,
            category: "login",
            outcome: "REJECTED",
            limitConfig: { emailMaxAttempts: 5, ipMaxAttempts: 20, windowSeconds: 900 },
            rejectionReason: result.reason || "RATE_LIMIT_EXCEEDED",
            statusCode: 429,
            redisAvailable: result.redisAvailable ?? true,
            userId: null,
            organizationId: null,
        }));

        const error = new ApiError(
            429,
            "Too many login attempts. Please try again later."
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
            category: "login",
            outcome: "ERROR",
            redisAvailable: false,
            redisError: error.message,
            userId: null,
            organizationId: null,
        }));
        return next(error);
    }
};
