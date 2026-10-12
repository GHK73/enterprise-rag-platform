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
        document.status !== "PROCESSING" &&
        document.status !== "DELETED" &&
        document.status !== "EXPIRED";

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

                {document.draftExpiresAt &&
                    document.status === "DRAFT" && (
                        <p className="document-current-status">
                            Draft Expires:{" "}
                            <strong>
                                {new Date(
                                    document.draftExpiresAt
                                ).toLocaleString()}
                            </strong>
                        </p>
                    )}

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
                        : document.status === "DELETED"
                        ? "Deleted"
                        : document.status === "EXPIRED"
                        ? "Expired"
                        : "Download"}
                </button>

            </div>

        </div>
    );
};

export default DocumentHeader;