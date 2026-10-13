import { Link } from "react-router-dom";

const FigureChunk = ({ source, index, metadata }) => {
    const caption = metadata.caption || "";
    const description = metadata.description || source.text || "";

    return (
        <div className="chunk-source chunk-figure-source">
            <div className="chunk-header">
                <span className="chunk-badge chunk-badge-figure">FIGURE</span>
                <span className="chunk-source-info">
                    Source {index} • Page {source.pageNumber || "?"} • Score: {source.score?.toFixed(2) || "N/A"}
                </span>
            </div>
            <div className="chunk-figure-content">
                {caption && (
                    <div className="figure-caption">
                        <strong>Caption:</strong> {caption}
                    </div>
                )}
                {description && (
                    <div className="figure-description">
                        {description}
                    </div>
                )}
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

export default FigureChunk;