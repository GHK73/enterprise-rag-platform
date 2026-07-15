import {
    useEffect,
    useState,
} from "react";

import {
    getDocumentAccessPolicies,
    grantDocumentAccess,
    updateDocumentAccessPolicy,
    revokeDocumentAccess,
} from "../../../api/document.api";

import api from "../../../api/axios";

import AccessPolicyForm from "./AccessPolicyForm";
import AccessPolicyTable from "./AccessPolicyTable";

const DocumentAccess = ({
    documentId,
}) => {
    const [policies, setPolicies] =
        useState([]);

    const [units, setUnits] =
        useState([]);

    const [members, setMembers] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState("");

    const [
        editingPolicy,
        setEditingPolicy,
    ] = useState(null);

    const loadAccessPolicies =
        async () => {
            try {
                const response =
                    await getDocumentAccessPolicies(
                        documentId
                    );

                setPolicies(
                    response || []
                );
            } catch {
                setPolicies([]);
            }
        };

    const loadOrganizationData =
        async () => {
            try {
                const [
                    unitsResponse,
                    membersResponse,
                ] = await Promise.all([
                    api.get(
                        "/organization/units"
                    ),
                    api.get(
                        "/organization/members"
                    ),
                ]);

                setUnits(
                    unitsResponse.data
                        .data || []
                );

                setMembers(
                    membersResponse.data
                        .data || []
                );
            } catch {
                setUnits([]);
                setMembers([]);
            }
        };

    const refreshData =
        async () => {
            await Promise.all([
                loadAccessPolicies(),
                loadOrganizationData(),
            ]);
        };

    const loadData =
        async () => {
            try {
                setLoading(true);
                setError("");

                await refreshData();
            } catch (err) {
                setError(
                    err?.response?.data
                        ?.message ||
                        "Failed to load access policies."
                );
            } finally {
                setLoading(false);
            }
        };

    const handleSubmit =
        async (accessData) => {
            try {
                setSaving(true);
                setError("");

                if (editingPolicy) {
                    await updateDocumentAccessPolicy(
                        editingPolicy.id,
                        accessData
                    );
                } else {
                    await grantDocumentAccess(
                        documentId,
                        accessData
                    );
                }

                await refreshData();

                setEditingPolicy(
                    null
                );
            } catch (err) {
                setError(
                    err?.response?.data
                        ?.message ||
                        "Failed to save access policy."
                );
            } finally {
                setSaving(false);
            }
        };

    const handleEdit =
        (policy) => {
            setEditingPolicy(
                policy
            );
        };

    const handleCancelEdit =
        () => {
            setEditingPolicy(
                null
            );
        };

    const handleDelete =
        async (policy) => {
            if (
                !window.confirm(
                    "Delete this access policy?"
                )
            ) {
                return;
            }

            try {
                setError("");

                await revokeDocumentAccess(
                    policy.id,
                    "Removed from frontend"
                );

                await refreshData();

                if (
                    editingPolicy?.id ===
                    policy.id
                ) {
                    setEditingPolicy(
                        null
                    );
                }
            } catch (err) {
                setError(
                    err?.response?.data
                        ?.message ||
                        "Failed to revoke access."
                );
            }
        };

    useEffect(() => {
        loadData();
    }, [documentId]);

    if (loading) {
        return (
            <div className="document-card">

                <h2>
                    Access Management
                </h2>

                <p>
                    Loading access
                    policies...
                </p>

            </div>
        );
    }

    return (
        <div className="document-card">

            <h2>
                {editingPolicy
                    ? "Edit Access Policy"
                    : "Access Management"}
            </h2>

            {error && (
                <div className="document-error">
                    {error}
                </div>
            )}

            <AccessPolicyForm
                units={units}
                members={members}
                loading={saving}
                editing={
                    Boolean(
                        editingPolicy
                    )
                }
                initialValues={
                    editingPolicy
                }
                onCancel={
                    handleCancelEdit
                }
                onSubmit={
                    handleSubmit
                }
            />

            <hr />

            <AccessPolicyTable
                policies={policies}
                onEdit={
                    handleEdit
                }
                onDelete={
                    handleDelete
                }
            />

        </div>
    );
};

export default DocumentAccess;