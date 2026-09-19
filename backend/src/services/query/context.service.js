const MAX_CONTEXT_CHARS = 12000;
const MAX_CHUNK_CHARS = 3000;

export const buildContext = (candidates) => {
    if (!candidates?.length) {
        return {
            context: "",
            sources: [],
        };
    }

    const sources = [];
    const contextParts = [];

    let totalChars = 0;

    for (const candidate of candidates) {
        const text = candidate.text?.trim() || "";

        if (!text) {
            continue;
        }

        const boundedText = text.slice(
            0,
            MAX_CHUNK_CHARS
        );

        if (
            totalChars + boundedText.length >
            MAX_CONTEXT_CHARS
        ) {
            break;
        }

        const sourceIndex =
            contextParts.length + 1;

        contextParts.push(
            [
                `[Source ${sourceIndex}]`,
                `Page: ${
                    candidate.page_number ?? "Unknown"
                }`,
                `Content:`,
                boundedText,
            ].join("\n")
        );

        sources.push({
            index: sourceIndex,
            chunkId: candidate.chunk_id,
            documentId: candidate.document_id,
            versionId: candidate.version_id,
            pageNumber: candidate.page_number,
            score: candidate.score,
        });

        totalChars += boundedText.length;
    }

    return {
        context: contextParts.join(
            "\n\n---\n\n"
        ),
        sources,
    };
};