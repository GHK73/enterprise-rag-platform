// backend/src/services/query/queryHistory.service.js
import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

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