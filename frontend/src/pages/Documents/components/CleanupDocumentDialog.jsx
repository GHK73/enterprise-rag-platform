import "./DocumentDialogs.css";

const CleanupDocumentDialog = ({
    open,
    loading,
    onConfirm,
    onCancel,
}) => {
    if (!open) {
        return null;
    }

    return (
        <div className="dialog-overlay">

            <div className="dialog">

                <h2>
                    Permanently Delete Document
                </h2>

                <p>

                    This action is irreversible.

                    <br />

                    All versions,
                    access policies,
                    audit history,
                    and files stored in S3
                    will be permanently removed.

                </p>

                <div className="dialog-actions">

                    <button
                        className="secondary-button"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        className="danger-button"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading
                            ? "Cleaning..."
                            : "Delete Forever"}
                    </button>

                </div>

            </div>

        </div>
    );
};

export default CleanupDocumentDialog;