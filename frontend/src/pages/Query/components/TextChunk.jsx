import { Link } from "react-router-dom";

const TextChunk = ({ source, index }) => {
    const text = source.text || "";

    return (
        <div className="chunk-source chunk-text-source">
            <div className="chunk-header">
                <span className="chunk-badge chunk-badge-text">TEXT</span>
                <span className="chunk-source-info">
                    Source {index} • Page {source.pageNumber || "?"} • Score: {source.score?.toFixed(2) || "N/A"}
                </span>
            </div>
            <div className="chunk-text-content">
                {text}
            </div>
            <div className="chunk-actions">
                {source.documentId && (
                    <Link to={`/documents/${source.documentId}`} className="chunk-link">
                        View Document
                    </Link>
                )}
            </div>
        </div>
    );
};

export default TextChunk;