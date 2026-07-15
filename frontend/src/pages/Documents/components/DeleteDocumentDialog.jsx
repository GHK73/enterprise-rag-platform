import "./DocumentDialogs.css";

const DeleteDocumentDialog = ({
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
                    Delete Document
                </h2>

                <p>
                    This document will be moved to the
                    deleted state. It can still be restored
                    later.
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
                            ? "Deleting..."
                            : "Delete"}
                    </button>

                </div>

            </div>

        </div>
    );
};

export default DeleteDocumentDialog;