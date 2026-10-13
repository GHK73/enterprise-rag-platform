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

    // Check for high-value structured evidence
    const hasStructuredEvidence = usableCandidates.some(c => 
        ['table', 'formula', 'code'].includes(c.chunk_type || 'text')
    );

    const topScore = Number(
        usableCandidates[0].score
    );

    if (topScore <= 0) {
        return {
            sufficient: false,
            reason: "LOW_RELEVANCE",
        };
    }

    // Boost confidence if we have structured evidence
    const reason = hasStructuredEvidence 
        ? "SUFFICIENT_EVIDENCE_WITH_STRUCTURED" 
        : "SUFFICIENT_EVIDENCE";

    return {
        sufficient: true,
        reason,
        hasStructuredEvidence,
    };
};