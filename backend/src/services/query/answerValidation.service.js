const SOURCE_PATTERN =
    /\[Source\s+(\d+)\]/gi;

export const validateGeneratedAnswer = (
    answer,
    sources
) => {
    if (!answer?.trim()) {
        return {
            valid: false,
            answer: null,
            reason: "EMPTY_LLM_RESPONSE",
        };
    }

    const sourceCount =
        sources?.length || 0;

    const citations = [
        ...answer.matchAll(
            SOURCE_PATTERN
        ),
    ];

    const invalidCitations =
        citations.filter((match) => {
            const sourceNumber =
                Number(match[1]);

            return (
                sourceNumber < 1 ||
                sourceNumber > sourceCount
            );
        });

    if (invalidCitations.length > 0) {
        return {
            valid: false,
            answer: null,
            reason: "INVALID_SOURCE_CITATION",
        };
    }

    return {
        valid: true,
        answer: answer.trim(),
        reason: "VALID_RESPONSE",
    };
};