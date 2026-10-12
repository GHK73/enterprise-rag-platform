import ApiError from "../utils/ApiError.js";

import {
    checkRegistrationRateLimit,
    recordRegistrationAttempt,
} from "../services/authRateLimit.service.js";

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
            return next();
        }

        const retryAfter =
            Number(result.retryAfter) || 1;

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
        return next(error);
    }
};
