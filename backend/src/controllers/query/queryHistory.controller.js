// backend/src/controllers/query/queryHistory.controller.js
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import {
    getQueryHistory,
} from "../../services/query/queryHistory.service.js";

export const getUserQueryHistory = asyncHandler(
    async (req, res) => {
        const {
            limit = 20,
            offset = 0,
        } = req.query;

        const parsedLimit = Number(limit);
        const parsedOffset = Number(offset);

        if (
            !Number.isInteger(parsedLimit) ||
            parsedLimit < 1 ||
            parsedLimit > 100
        ) {
            return res.status(400).json(
                new ApiResponse(
                    400,
                    null,
                    "limit must be an integer between 1 and 100."
                )
            );
        }

        if (
            !Number.isInteger(parsedOffset) ||
            parsedOffset < 0
        ) {
            return res.status(400).json(
                new ApiResponse(
                    400,
                    null,
                    "offset must be a non-negative integer."
                )
            );
        }

        const history = await getQueryHistory(
            req.user,
            parsedLimit,
            parsedOffset
        );

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    history,
                    limit: parsedLimit,
                    offset: parsedOffset,
                },
                "Query history fetched successfully."
            )
        );
    }
);