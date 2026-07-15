const DocumentHeader = ({
    document,
    publishing,
    downloading,
    onPublish,
    onDownload,
}) => {
    return (
        <div className="document-header">

            <div>

                <h1>
                    {document.title}
                </h1>

                <p>
                    {document.description ||
                        "No description"}
                </p>
                <p className="document-current-status">

                    Current Status:
                    <strong>
                        {" "}
                        {document.status}
                    </strong>

                </p>

            </div>

            <div className="document-actions">

                {document.status ===
                    "DRAFT" && (
                    <button
                        className="primary-button"
                        onClick={onPublish}
                        disabled={publishing}
                    >
                        {publishing
                            ? "Publishing..."
                            : "Publish"}
                    </button>
                )}

                    <button
                        className="secondary-button"
                        onClick={onDownload}
                        disabled={
                            downloading ||
                            document.status === "DRAFT"
                        }
                    >
                    {downloading
                        ? "Downloading..."
                        : document.status === "PROCESSING"
                        ? "Processing..."
                        : "Download"}
                </button>

            </div>

        </div>
    );
};

export default DocumentHeader;