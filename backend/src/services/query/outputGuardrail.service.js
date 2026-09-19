const UNSAFE_PATTERNS = [
    /system prompt/i,
    /developer message/i,
    /hidden instructions/i,
    /chain[- ]of[- ]thought/i,
];

export const validateGeneratedAnswer = (
    answer
) => {
    if (
        typeof answer !== "string" ||
        !answer.trim()
    ) {
        return {
            safe: false,
            answer:
                "I could not generate a reliable answer from the provided documents.",
        };
    }

    const containsInternalInstructionRequest =
        UNSAFE_PATTERNS.some((pattern) =>
            pattern.test(answer)
        );

    if (containsInternalInstructionRequest) {
        return {
            safe: false,
            answer:
                "I could not provide that information.",
        };
    }

    return {
        safe: true,
        answer: answer.trim(),
    };
};