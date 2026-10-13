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

const formatChunkForContext = (candidate, sourceNumber) => {
    const chunkType = candidate.chunk_type || "text";
    const metadata = candidate.metadata || {};
    const pageNumber = candidate.page_number ?? "Unknown";

    switch (chunkType) {
        case "table": {
            const markdown = metadata.markdown || candidate.text;
            return [
                `[Source ${sourceNumber}]`,
                `Page: ${pageNumber}`,
                `Type: Table`,
                "Content:",
                markdown,
            ].join("\n");
        }
        case "formula": {
            const latex = metadata.latex || candidate.text;
            return [
                `[Source ${sourceNumber}]`,
                `Page: ${pageNumber}`,
                `Type: Formula`,
                "LaTeX:",
                latex,
            ].join("\n");
        }
        case "figure": {
            const caption = metadata.caption || "";
            const description = metadata.description || candidate.text;
            return [
                `[Source ${sourceNumber}]`,
                `Page: ${pageNumber}`,
                `Type: Figure`,
                caption ? `Caption: ${caption}` : "",
                "Description:",
                description,
            ].filter(Boolean).join("\n");
        }
        case "code": {
            const language = metadata.language || "text";
            return [
                `[Source ${sourceNumber}]`,
                `Page: ${pageNumber}`,
                `Type: Code (${language})`,
                "Content:",
                candidate.text,
            ].join("\n");
        }
        case "image": {
            const caption = metadata.caption || candidate.text;
            return [
                `[Source ${sourceNumber}]`,
                `Page: ${pageNumber}`,
                `Type: Image`,
                caption ? `Caption: ${caption}` : "",
            ].filter(Boolean).join("\n");
        }
        default: {
            return [
                `[Source ${sourceNumber}]`,
                `Page: ${pageNumber}`,
                "Content:",
                sanitizeChunk(candidate.text),
            ].join("\n");
        }
    }
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

        const text = sanitizeChunk(candidate.text);

        if (!text) {
            continue;
        }

        const sourceNumber = sources.length + 1;

        const block = formatChunkForContext(candidate, sourceNumber);

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
            chunkType:
                candidate.chunk_type || "text",
            metadata:
                candidate.metadata || {},
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