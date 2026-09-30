// backend/src/services/authRateLimit.service.js

import redisConnection from "../config/redis.js";
import config from "../config/config.js";

const LOGIN_RATE_LIMIT_PREFIX = "rag:login";

const LOGIN_EMAIL_MAX_ATTEMPTS = 5;
const LOGIN_IP_MAX_ATTEMPTS = 20;

const LOGIN_WINDOW_SECONDS = 15 * 60;

const normalizeEmail = (email) => {
    return email.trim().toLowerCase();
};

const buildEmailKey = (email) => {
    const normalizedEmail = normalizeEmail(email);

    return `${LOGIN_RATE_LIMIT_PREFIX}:email:${normalizedEmail}`;
};

const buildIpKey = (ip) => {
    return `${LOGIN_RATE_LIMIT_PREFIX}:ip:${ip}`;
};

const getRemainingTtl = async (key) => {
    const ttl = await redisConnection.ttl(key);

    if (ttl > 0) {
        return ttl;
    }

    return LOGIN_WINDOW_SECONDS;
};

export const checkLoginRateLimit = async ({
    email,
    ip,
}) => {
    if (!config.redis.enabled) {
        return;
    }

    try {
        const emailKey = buildEmailKey(email);
        const ipKey = buildIpKey(ip);

        const [emailAttempts, ipAttempts] =
            await Promise.all([
                redisConnection.get(emailKey),
                redisConnection.get(ipKey),
            ]);

        const emailCount = Number(emailAttempts || 0);
        const ipCount = Number(ipAttempts || 0);

        if (emailCount >= LOGIN_EMAIL_MAX_ATTEMPTS) {
            const retryAfter =
                await getRemainingTtl(emailKey);

            return {
                blocked: true,
                retryAfter,
                reason: "EMAIL_RATE_LIMIT",
            };
        }

        if (ipCount >= LOGIN_IP_MAX_ATTEMPTS) {
            const retryAfter =
                await getRemainingTtl(ipKey);

            return {
                blocked: true,
                retryAfter,
                reason: "IP_RATE_LIMIT",
            };
        }

        return {
            blocked: false,
        };
    } catch (error) {
        /*
         * Fail open if Redis is unavailable.
         *
         * Authentication itself must remain available even
         * when the rate-limiting infrastructure is unavailable.
         */
        console.error(
            "Redis login rate-limit check failed:",
            error.message
        );

        return {
            blocked: false,
        };
    }
};

export const recordFailedLogin = async ({
    email,
    ip,
}) => {
    if (!config.redis.enabled) {
        return;
    }

    try {
        const emailKey = buildEmailKey(email);
        const ipKey = buildIpKey(ip);

        /*
         * Increment both counters atomically enough for our
         * fixed-window protection.
         *
         * EXPIRE is only set when the counter is first created.
         */

        const emailCount = await redisConnection.incr(
            emailKey
        );

        if (emailCount === 1) {
            await redisConnection.expire(
                emailKey,
                LOGIN_WINDOW_SECONDS
            );
        }

        const ipCount = await redisConnection.incr(
            ipKey
        );

        if (ipCount === 1) {
            await redisConnection.expire(
                ipKey,
                LOGIN_WINDOW_SECONDS
            );
        }
    } catch (error) {
        /*
         * Do not turn a Redis failure into an authentication
         * failure.
         */
        console.error(
            "Redis failed-login counter update failed:",
            error.message
        );
    }
};

export const clearEmailLoginFailures = async (
    email
) => {
    if (!config.redis.enabled) {
        return;
    }

    try {
        const emailKey = buildEmailKey(email);

        await redisConnection.del(emailKey);
    } catch (error) {
        console.error(
            "Redis login failure-counter reset failed:",
            error.message
        );
    }
};

export const getLoginRateLimitConfig = () => {
    return {
        emailMaxAttempts: LOGIN_EMAIL_MAX_ATTEMPTS,
        ipMaxAttempts: LOGIN_IP_MAX_ATTEMPTS,
        windowSeconds: LOGIN_WINDOW_SECONDS,
    };
};