// backend/src/services/query/queryHistory.service.js
import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import config from "../../config/config.js";

export const getQueryHistory = async (
    user,
    limit = 20,
    offset = 0
) => {
    const organizationId = user?.unit?.organizationId;

    if (!organizationId) {
        throw new ApiError(
            403,
            "User organization could not be determined."
        );
    }

    return await prisma.queryHistory.findMany({
        where: {
            organizationId,
            userId: user.id,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: limit,
        skip: offset,
        select: {
            id: true,
            query: true,
            answer: true,
            sources: true,
            evidence: true,
            usedLLM: true,
            outputGuardPassed: true,
            createdAt: true,
        },
    });
};

export const cleanupQueryHistory = async (organizationId, retentionDays = null) => {
    const days = retentionDays ?? config.queryHistory?.retentionDays ?? 90;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.queryHistory.deleteMany({
        where: {
            organizationId,
            createdAt: {
                lt: cutoffDate,
            },
        },
    });

    return {
        deletedCount: result.count,
        cutoffDate,
        retentionDays: days,
    };
};