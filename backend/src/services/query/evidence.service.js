export const checkEvidenceSufficiency = (
    candidates
) => {
    if (!candidates?.length) {
        return {
            sufficient: false,
            reason: "NO_AUTHORIZED_EVIDENCE",
        };
    }

    const usableCandidates = candidates.filter(
        (candidate) =>
            candidate?.text?.trim() &&
            Number.isFinite(
                Number(candidate.score)
            )
    );

    if (!usableCandidates.length) {
        return {
            sufficient: false,
            reason: "NO_USABLE_EVIDENCE",
        };
    }

    const topScore = Number(
        usableCandidates[0].score
    );

    if (topScore <= 0) {
        return {
            sufficient: false,
            reason: "LOW_RELEVANCE",
        };
    }

    return {
        sufficient: true,
        reason: "SUFFICIENT_EVIDENCE",
    };
};