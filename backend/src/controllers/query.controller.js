import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
    retrieveAuthorizedCandidates,
} from "../services/query/query.service.js";

/*
 * The orchestrator is injectable so the
 * response contract — the shape the
 * frontend consumes — can be tested
 * without live infrastructure. Production
 * uses the real retrieveAuthorizedCandidates.
 */
export const queryDocumentsHandler = async (
    req,
    res,
    orchestrate = retrieveAuthorizedCandidates
) => {
    const {
        query,
        topK = 5,
    } = req.body;

    if (!query?.trim()) {
        return res.status(400).json(
            new ApiResponse(
                400,
                "Query is required."
            )
        );
    }

    const parsedTopK = Number(topK);

    if (
        !Number.isInteger(parsedTopK) ||
        parsedTopK < 1 ||
        parsedTopK > 20
    ) {
        return res.status(400).json(
            new ApiResponse(
                400,
                "topK must be an integer between 1 and 20."
            )
        );
    }

    const result =
        await orchestrate(
            req.user,
            query.trim(),
            parsedTopK
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Query executed successfully.",
            {
                query: result.query,
                answer: result.answer,
                sources: result.sources,
                evidence: result.evidence,
                usedLLM: result.usedLLM,
                outputGuardPassed:
                    result.outputGuardPassed,
            }
        )
    );
};

export const queryDocuments = asyncHandler(
    queryDocumentsHandler
);
