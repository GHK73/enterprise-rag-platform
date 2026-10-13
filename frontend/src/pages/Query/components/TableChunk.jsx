import { Link } from "react-router-dom";

const TableChunk = ({ source, index, metadata }) => {
    const markdown = metadata.markdown || "";

    const renderMarkdownTable = () => {
        if (!markdown) return null;
        
        const lines = markdown.trim().split('\n');
        if (lines.length < 2) return <pre>{markdown}</pre>;

        const headerRow = lines[0].split('|').map(c => c.trim()).filter(Boolean);
        const dataRows = lines.slice(2).map(line => 
            line.split('|').map(c => c.trim()).filter(Boolean)
        );

        return (
            <div className="table-container">
                <table className="chunk-table">
                    <thead>
                        <tr>
                            {headerRow.map((cell, i) => (
                                <th key={i}>{cell}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {dataRows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="chunk-source chunk-table-source">
            <div className="chunk-header">
                <span className="chunk-badge chunk-badge-table">TABLE</span>
                <span className="chunk-source-info">
                    Source {index} • Page {source.pageNumber || "?"} • Score: {source.score?.toFixed(2) || "N/A"}
                </span>
            </div>
            {renderMarkdownTable()}
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

export default TableChunk;