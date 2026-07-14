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

            </div>

            <div className="document-actions">

                {document.lifecycle ===
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
                    disabled={downloading}
                >
                    {downloading
                        ? "Downloading..."
                        : "Download"}
                </button>

            </div>

        </div>
    );
};

export default DocumentHeader;