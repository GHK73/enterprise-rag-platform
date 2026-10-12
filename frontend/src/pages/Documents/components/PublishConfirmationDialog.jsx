import "./DocumentDialogs.css";

const PublishConfirmationDialog = ({
    open,
    document,
    onCancel,
    onConfirm,
    loading,
}) => {
    if (!open || !document) {
        return null;
    }

    const hasFile = Boolean(document.currentVersionId);

    return (
        <div className="dialog-backdrop">
            <div className="dialog">
                <h3>Publish Document</h3>
                <p>Review the document before publishing.</p>

                <div className="dialog-details">
                    <p>
                        <strong>Title:</strong> {document.title}
                    </p>
                    {document.description && (
                        <p>
                            <strong>Description:</strong>{" "}
                            {document.description}
                        </p>
                    )}
                    <p>
                        <strong>Classification:</strong>{" "}
                        {document.classification}
                    </p>
                    <p>
                        <strong>File:</strong>{" "}
                        {hasFile ? "Uploaded" : "Not uploaded"}
                    </p>
                    {document.draftExpiresAt && (
                        <p>
                            <strong>Draft expires:</strong>{" "}
                            {new Date(
                                document.draftExpiresAt
                            ).toLocaleString()}
                        </p>
                    )}
                </div>

                <p>
                    Publishing will submit this draft for processing.
                    Continue?
                </p>

                <div className="dialog-actions">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="secondary"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading || !hasFile}
                        className="primary"
                    >
                        {loading ? "Publishing..." : "Publish"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublishConfirmationDialog;
