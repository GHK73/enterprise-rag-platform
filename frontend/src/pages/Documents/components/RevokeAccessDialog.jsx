import "./DocumentDialogs.css";

const RevokeAccessDialog = ({
    open,
    policy,
    reason,
    onReasonChange,
    onCancel,
    onConfirm,
    loading,
}) => {
    if (!open) {
        return null;
    }

    return (
        <div className="dialog-backdrop">
            <div className="dialog">
                <h3>Revoke Access</h3>
                <p>
                    Are you sure you want to revoke this access
                    policy?
                </p>

                {policy && (
                    <div className="dialog-details">
                        <p>
                            <strong>Subject:</strong>{" "}
                            {policy.subjectName ||
                                policy.subjectType}
                        </p>
                        <p>
                            <strong>Permission:</strong>{" "}
                            {policy.action}
                        </p>
                        <p>
                            <strong>Effect:</strong>{" "}
                            {policy.effect}
                        </p>
                    </div>
                )}

                <div className="form-group">
                    <label>Reason</label>
                    <textarea
                        value={reason}
                        onChange={(event) =>
                            onReasonChange(event.target.value)
                        }
                        rows={3}
                        placeholder="Enter reason for revoking access..."
                    />
                </div>

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
                        disabled={loading}
                        className="danger"
                    >
                        {loading ? "Revoking..." : "Revoke"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RevokeAccessDialog;
