export const rerankCandidates = (
    candidates,
    topK = 5
) => {
    if (!candidates?.length) {
        return [];
    }

    return [...candidates]
        .sort(
            (a, b) =>
                Number(b.score || 0) -
                Number(a.score || 0)
        )
        .slice(0, topK);
};