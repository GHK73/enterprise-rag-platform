import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
    retrieveAuthorizedCandidates,
} from "../services/query/query.service.js";

export const queryDocuments = asyncHandler(
    async (req, res) => {
        const {
            query,
            topK = 5,
        } = req.body;

        if (!query?.trim()) {
            return res.status(400).json(
                new ApiResponse(
                    400,
                    null,
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
                    null,
                    "topK must be an integer between 1 and 20."
                )
            );
        }

        const result =
            await retrieveAuthorizedCandidates(
                req.user,
                query.trim(),
                parsedTopK
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    query: result.query,
                    answer: result.answer,
                    sources: result.sources,
                    evidence: result.evidence,
                    usedLLM: result.usedLLM,
                    outputGuardPassed:
                        result.outputGuardPassed,
                },
                "Query executed successfully."
            )
        );
    }
);