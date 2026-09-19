const MAX_CHUNK_LENGTH = 4000;
const MAX_CONTEXT_LENGTH = 18000;

const normalizeText = (text) => {
    if (!text) {
        return "";
    }

    return text
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();
};

const sanitizeChunk = (text) => {
    const normalized = normalizeText(text);

    if (!normalized) {
        return "";
    }

    return normalized.slice(
        0,
        MAX_CHUNK_LENGTH
    );
};

export const buildSafeContext = (
    candidates
) => {
    if (!candidates?.length) {
        return {
            context: "",
            sources: [],
        };
    }

    const sources = [];
    const contextParts = [];

    let currentLength = 0;

    for (
        let index = 0;
        index < candidates.length;
        index++
    ) {
        const candidate =
            candidates[index];

        const text =
            sanitizeChunk(
                candidate.text
            );

        if (!text) {
            continue;
        }

        const sourceNumber =
            sources.length + 1;

        const block = [
            `[Source ${sourceNumber}]`,
            `Page: ${
                candidate.page_number ??
                "Unknown"
            }`,
            "Content:",
            text,
        ].join("\n");

        if (
            currentLength +
                block.length >
            MAX_CONTEXT_LENGTH
        ) {
            break;
        }

        contextParts.push(block);

        sources.push({
            index: sourceNumber,
            chunkId:
                candidate.chunk_id,
            documentId:
                candidate.document_id,
            versionId:
                candidate.version_id,
            pageNumber:
                candidate.page_number,
            score:
                candidate.score,
        });

        currentLength +=
            block.length;
    }

    return {
        context:
            contextParts.join(
                "\n\n---\n\n"
            ),
        sources,
    };
};