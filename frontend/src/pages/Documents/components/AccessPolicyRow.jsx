const AccessPolicyRow = ({
    policy,
    onEdit,
    onDelete,
}) => {
    return (
        <tr>

            <td>
                {policy.subjectName}
            </td>

            <td>
                {policy.subjectType}
            </td>

            <td>
                {policy.permission}
            </td>

            <td>
                {policy.expiresAt
                    ? "Yes"
                    : "No"}
            </td>

            <td>

                <button
                    className="secondary-button"
                    onClick={() =>
                        onEdit(policy)
                    }
                >
                    Edit
                </button>

                <button
                    className="danger-button"
                    onClick={() =>
                        onDelete(policy)
                    }
                >
                    Delete
                </button>

            </td>

        </tr>
    );
};

export default AccessPolicyRow;