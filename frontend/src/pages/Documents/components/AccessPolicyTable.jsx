import AccessPolicyRow from "./AccessPolicyRow";

const AccessPolicyTable = ({
    policies,
    onEdit,
    onDelete,
}) => {
    if (policies.length === 0) {
        return (
            <p>
                No access policies found.
            </p>
        );
    }

    return (
        <table className="document-version-table">

            <thead>

                <tr>

                    <th>
                        Subject
                    </th>

                    <th>
                        Type
                    </th>

                    <th>
                        Permission
                    </th>

                    <th>
                        Temporary
                    </th>

                    <th>
                        Actions
                    </th>

                </tr>

            </thead>

            <tbody>

                {policies.map((policy) => (
                    <AccessPolicyRow
                        key={policy.id}
                        policy={policy}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}

            </tbody>

        </table>
    );
};

export default AccessPolicyTable;