import { Link } from "react-router-dom";

const FormulaChunk = ({ source, index, metadata }) => {
    const latex = metadata.latex || source.text || "";

    return (
        <div className="chunk-source chunk-formula-source">
            <div className="chunk-header">
                <span className="chunk-badge chunk-badge-formula">FORMULA</span>
                <span className="chunk-source-info">
                    Source {index} • Page {source.pageNumber || "?"} • Score: {source.score?.toFixed(2) || "N/A"}
                </span>
            </div>
            <div className="chunk-formula-content">
                <div className="formula-latex">
                    {latex}
                </div>
                <div className="formula-rendered">
                    $$${latex}$$
                </div>
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

export default FormulaChunk;