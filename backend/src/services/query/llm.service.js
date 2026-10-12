import {
    BedrockRuntimeClient,
    ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

import config from "../../config/config.js";

import {
    buildSystemPrompt,
} from "./prompt.service.js";

import ApiError from "../../utils/ApiError.js";

const client = new BedrockRuntimeClient({
    region: config.llm.region,
});

export const generateAnswer = async (
    prompt
) => {
    if (
        typeof prompt !== "string" ||
        !prompt.trim()
    ) {
        throw new ApiError(
            400,
            "PROMPT_REQUIRED"
        );
    }

    const command = new ConverseCommand({
        modelId: config.llm.modelId,

        system: [
            {
                text: buildSystemPrompt(),
            },
        ],

        messages: [
            {
                role: "user",
                content: [
                    {
                        text: prompt.trim(),
                    },
                ],
            },
        ],

        inferenceConfig: {
            maxTokens: config.llm.maxTokens,
            temperature: config.llm.temperature,
        },
    });

    const response =
        await client.send(command);

    const answer =
        response?.output?.message?.content
            ?.map(
                (item) =>
                    item?.text || ""
            )
            .join("")
            .trim();

    if (!answer) {
        throw new ApiError(
            502,
            "EMPTY_LLM_RESPONSE"
        );
    }

    return answer;
};