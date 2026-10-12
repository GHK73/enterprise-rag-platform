import AccessPolicyRow from "./AccessPolicyRow";

const AccessPolicyTable = ({
    policies,
    organization,
    units,
    members,
    onEdit,
    onDelete,
}) => {
    const activePolicies = (policies || []).filter(
        (policy) => policy.isActive
    );

    if (activePolicies.length === 0) {
        return (
            <div className="document-empty-state">
                <h3>No Access Policies</h3>

                <p>
                    This document does not have any
                    active access policies yet. Grant access
                    to users, units, roles, or the
                    organization using the form above.
                </p>
            </div>
        );
    }

    return (
        <div className="document-table-wrapper">

            <table className="document-version-table">

                <thead>

                    <tr>

                        <th>Subject</th>

                        <th>Subject Type</th>

                        <th>Permission</th>

                        <th>Temporary</th>

                        <th>Actions</th>

                    </tr>

                </thead>

                <tbody>

                    {activePolicies.map((policy) => (
                        <AccessPolicyRow
                            key={policy.id}
                            policy={policy}
                            organization={organization}
                            units={units}
                            members={members}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}

                </tbody>

            </table>

        </div>
    );
};

export default AccessPolicyTable;