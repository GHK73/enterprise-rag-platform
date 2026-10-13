import { Link } from "react-router-dom";

const CodeChunk = ({ source, index, metadata }) => {
    const language = metadata.language || "text";
    const code = source.text || "";

    return (
        <div className="chunk-source chunk-code-source">
            <div className="chunk-header">
                <span className="chunk-badge chunk-badge-code">CODE</span>
                <span className="chunk-language">{language}</span>
                <span className="chunk-source-info">
                    Source {index} • Page {source.pageNumber || "?"} • Score: {source.score?.toFixed(2) || "N/A"}
                </span>
            </div>
            <pre className="chunk-code"><code>{code}</code></pre>
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

export default CodeChunk;