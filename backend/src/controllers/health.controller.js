// backend/src/controllers/health.controller.js

import ApiResponse from "../utils/ApiResponse.js";
import prisma from "../config/prisma.js";
import config from "../config/config.js";
import { redisClient } from "../config/redis.js";
import aiClient from "../config/ai.js";

const checkDatabase = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: "healthy", latency: null };
    } catch (error) {
        return { status: "unhealthy", error: error.message };
    }
};

const checkRedis = async () => {
    if (!config.redis.enabled || !redisClient) {
        return { status: "disabled" };
    }
    try {
        const start = Date.now();
        await redisClient.ping();
        return { status: "healthy", latency: Date.now() - start };
    } catch (error) {
        return { status: "unhealthy", error: error.message };
    }
};

const checkAIService = async () => {
    try {
        const start = Date.now();
        await aiClient.get("/health", { timeout: 5000 });
        return { status: "healthy", latency: Date.now() - start };
    } catch (error) {
        return { status: "unhealthy", error: error.message };
    }
};

const healthCheck = async (req, res) => {
    const [database, redis, aiService] = await Promise.allSettled([
        checkDatabase(),
        checkRedis(),
        checkAIService(),
    ]);

    const checks = {
        database: database.status === "fulfilled" ? database.value : { status: "unhealthy", error: database.reason?.message },
        redis: redis.status === "fulfilled" ? redis.value : { status: "unhealthy", error: redis.reason?.message },
        aiService: aiService.status === "fulfilled" ? aiService.value : { status: "unhealthy", error: aiService.reason?.message },
    };

    const allHealthy = Object.values(checks).every((c) => c.status === "healthy" || c.status === "disabled");
    const statusCode = allHealthy ? 200 : 503;

    return res.status(statusCode).json(
        new ApiResponse(
            statusCode,
            allHealthy ? "All systems operational" : "Some dependencies unhealthy",
            { checks }
        )
    );
};

export default healthCheck;