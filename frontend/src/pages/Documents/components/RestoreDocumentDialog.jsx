import "./DocumentDialogs.css";

const RestoreDocumentDialog = ({
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
                    Restore Document
                </h2>

                <p>
                    Restore this document and make it
                    available again.
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
                        className="primary-button"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading
                            ? "Restoring..."
                            : "Restore"}
                    </button>

                </div>

            </div>

        </div>
    );
};

export default RestoreDocumentDialog;