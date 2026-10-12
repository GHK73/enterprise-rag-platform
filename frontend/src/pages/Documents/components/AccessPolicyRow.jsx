const AccessPolicyRow = ({
    policy,
    onEdit,
    onDelete,
    organization,
    units,
    members,
}) => {
    const formatExpiry = (validUntil) => {
        if (!validUntil) {
            return "Permanent";
        }

        return new Date(
            validUntil
        ).toLocaleString();
    };

    const resolveSubjectName = () => {
        switch (policy.subjectType) {
            case "ORGANIZATION":
                return organization?.name || "Organization";
            case "UNIT": {
                const unit = units?.find(
                    (u) => u.id === policy.subjectUnitId
                );
                return unit?.name || "Unknown Unit";
            }
            case "ROLE":
                return policy.subjectRole || "Unknown Role";
            case "USER": {
                const member = members?.find(
                    (m) => m.id === policy.subjectUserId
                );
                return (
                    member?.fullName ||
                    member?.name ||
                    member?.email ||
                    "Unknown User"
                );
            }
            default:
                return "Unknown";
        }
    };

    const subjectName = resolveSubjectName();
    const isRevoked = !policy.isActive;

    return (
        <tr className={isRevoked ? "revoked-row" : ""}>

            <td>
                <strong>
                    {subjectName}
                </strong>
                {isRevoked && (
                    <small className="document-deleted">
                        Revoked
                    </small>
                )}
            </td>

            <td>
                {policy.subjectType}
            </td>

            <td>

                <span
                    className={
                        policy.effect ===
                        "ALLOW"
                            ? "permission-badge allow"
                            : "permission-badge deny"
                    }
                >
                    {policy.effect}
                </span>

            </td>

            <td>

                {formatExpiry(
                    policy.validUntil
                )}

            </td>

            <td>

                <div className="table-actions">

                    <button
                        type="button"
                        className="secondary-button"
                        disabled={isRevoked}
                        onClick={() =>
                            onEdit(policy)
                        }
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        className="danger-button"
                        disabled={isRevoked}
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