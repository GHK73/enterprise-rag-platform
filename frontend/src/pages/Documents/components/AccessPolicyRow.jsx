const AccessPolicyRow = ({
    policy,
    onEdit,
    onDelete,
}) => {
    const formatExpiry = (expiresAt) => {
        if (!expiresAt) {
            return "Permanent";
        }

        return new Date(
            expiresAt
        ).toLocaleString();
    };

    const subjectName =
        policy.subjectName ||
        policy.subjectUser?.name ||
        policy.subjectUnit?.name ||
        policy.subjectRole ||
        "Unknown";

    return (
        <tr>

            <td>
                <strong>
                    {subjectName}
                </strong>
            </td>

            <td>
                {policy.subjectType}
            </td>

            <td>

                <span
                    className={
                        policy.permission ===
                        "ALLOW"
                            ? "permission-badge allow"
                            : "permission-badge deny"
                    }
                >
                    {policy.permission}
                </span>

            </td>

            <td>

                {formatExpiry(
                    policy.expiresAt
                )}

            </td>

            <td>

                <div className="table-actions">

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                            onEdit(policy)
                        }
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                            onDelete(policy)
                        }
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    );
};

export default AccessPolicyRow;