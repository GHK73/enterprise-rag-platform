// backend/src/middleware/loginRateLimit.middleware.js

import ApiError from "../utils/ApiError.js";
import {
    checkLoginRateLimit,
} from "../services/authRateLimit.service.js";

export const loginRateLimiter = async (
    req,
    res,
    next
) => {
    try {
        const email =
            typeof req.body?.email === "string"
                ? req.body.email.trim().toLowerCase()
                : "";

        const ip = req.ip;

        /*
         * If email is missing, normal request validation inside
         * the authentication flow should handle it.
         *
         * We still perform IP-based protection when possible.
         */

        if (!ip) {
            return next();
        }

        const result = await checkLoginRateLimit({
            email,
            ip,
        });

        if (!result.blocked) {
            return next();
        }

        const error = new ApiError(
            429,
            "Too many login attempts. Please try again later."
        );

        error.retryAfter = result.retryAfter;

        res.set(
            "Retry-After",
            String(result.retryAfter)
        );

        return next(error);
    } catch (error) {
        return next(error);
    }
};