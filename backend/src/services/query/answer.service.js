import {
    generateAnswer,
} from "./llm.service.js";

import {
    validateGeneratedAnswer,
} from "./answerValidation.service.js";

export const generateQueryAnswer = async (
    result
) => {
    if (!result?.evidence?.sufficient) {
        return {
            answer:
                "I couldn't find sufficient information in the authorized documents to answer this question.",
            usedLLM: false,
        };
    }

    if (!result.prompt?.trim()) {
        return {
            answer:
                "I couldn't generate an answer because sufficient context was not available.",
            usedLLM: false,
        };
    }

    const generatedAnswer =
        await generateAnswer(
            result.prompt
        );

    const validation =
        validateGeneratedAnswer(
            generatedAnswer,
            result.sources
        );

    if (!validation.valid) {
        return {
            answer:
                "I couldn't produce a reliable answer from the authorized documents.",
            usedLLM: true,
            validationFailed: true,
            reason: validation.reason,
        };
    }

    return {
        answer: validation.answer,
        usedLLM: true,
        validationFailed: false,
    };
};