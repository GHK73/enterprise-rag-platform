const DocumentHeader = ({
    document,
    publishing,
    downloading,
    onPublish,
    onDownload,
}) => {
    const canPublish =
        document.status === "DRAFT" &&
        !publishing;

    const canDownload =
        !downloading &&
        document.status !== "DRAFT" &&
        document.status !== "PROCESSING";

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

                {document.status === "DRAFT" && (
                    <button
                        className="primary-button"
                        onClick={onPublish}
                        disabled={!canPublish}
                    >
                        {publishing
                            ? "Publishing..."
                            : "Publish"}
                    </button>
                )}

                <button
                    className="secondary-button"
                    onClick={onDownload}
                    disabled={!canDownload}
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