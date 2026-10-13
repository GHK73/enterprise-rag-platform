import TableChunk from "./TableChunk";
import FormulaChunk from "./FormulaChunk";
import FigureChunk from "./FigureChunk";
import CodeChunk from "./CodeChunk";
import TextChunk from "./TextChunk";

const ChunkRenderer = ({ source, index }) => {
    const chunkType = source.chunkType || "text";
    const metadata = source.metadata || {};

    switch (chunkType) {
        case "table":
            return <TableChunk source={source} index={index} metadata={metadata} />;
        case "formula":
            return <FormulaChunk source={source} index={index} metadata={metadata} />;
        case "figure":
            return <FigureChunk source={source} index={index} metadata={metadata} />;
        case "code":
            return <CodeChunk source={source} index={index} metadata={metadata} />;
        case "image":
            return <FigureChunk source={source} index={index} metadata={metadata} />;
        default:
            return <TextChunk source={source} index={index} />;
    }
};

export default ChunkRenderer;