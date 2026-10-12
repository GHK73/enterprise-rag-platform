import {
    useEffect,
    useState,
    useCallback,
} from "react";

import {
    getDocumentAccessPolicies,
    grantDocumentAccess,
    grantTemporaryDocumentAccess,
    updateDocumentAccessPolicy,
    revokeDocumentAccess,
} from "../../../api/document.api";

import api from "../../../api/axios";

import AccessPolicyForm from "./AccessPolicyForm";
import AccessPolicyTable from "./AccessPolicyTable";
import RevokeAccessDialog from "./RevokeAccessDialog";

const DocumentAccess = ({
    documentId,
}) => {
    const [policies, setPolicies] =
        useState([]);

    const [organization, setOrganization] =
        useState(null);

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
        showRevokeDialog,
        setShowRevokeDialog,
    ] = useState(false);

    const [
        policyToRevoke,
        setPolicyToRevoke,
    ] = useState(null);

const [revokeReason, setRevokeReason] =
        useState("");

    const [editingPolicy, setEditingPolicy] = useState(null);


const loadAccessPolicies = useCallback(async () => {
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
        }, [documentId]);

    const loadOrganizationData = useCallback(async () => {
            try {
                const [
                    organizationResponse,
                    unitsResponse,
                    membersResponse,
                ] = await Promise.all([
                    api.get(
                        "/organization"
                    ),
                    api.get(
                        "/organization/units"
                    ),
                    api.get(
                        "/organization/members"
                    ),
                ]);

                setOrganization(
                    organizationResponse.data
                        .data || null
                );

                setUnits(
                    unitsResponse.data
                        .data || []
                );

                setMembers(
                    membersResponse.data
                        .data || []
                );
            } catch {
                setOrganization(null);
                setUnits([]);
                setMembers([]);
            }
        }, []);

    const refreshData = useCallback(async () => {
            await Promise.all([
                loadAccessPolicies(),
                loadOrganizationData(),
            ]);
        }, [loadAccessPolicies, loadOrganizationData]);

    const loadData = useCallback(async () => {
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
        }, [refreshData]);

    const handleSubmit =
        async (accessData, isTemporary) => {
            try {
                setSaving(true);
                setError("");

                if (editingPolicy) {
                    await updateDocumentAccessPolicy(
                        editingPolicy.id,
                        accessData
                    );
                } else if (isTemporary) {
                    await grantTemporaryDocumentAccess(
                        documentId,
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

    const handleDelete = (policy) => {
        setPolicyToRevoke(policy);
        setRevokeReason("");
        setShowRevokeDialog(true);
    };

    const handleConfirmRevoke = async () => {
        if (!policyToRevoke) {
            return;
        }

        try {
            setSaving(true);
            setError("");

            await revokeDocumentAccess(
                policyToRevoke.id,
                revokeReason || null
            );

            await refreshData();

            if (
                editingPolicy?.id ===
                policyToRevoke.id
            ) {
                setEditingPolicy(null);
            }

            setShowRevokeDialog(false);
            setPolicyToRevoke(null);
            setRevokeReason("");
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to revoke access."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleCancelRevoke = () => {
        setShowRevokeDialog(false);
        setPolicyToRevoke(null);
        setRevokeReason("");
    };

    useEffect(() => {
        async function initialize() {
            await loadData();
        }
        initialize();
    }, [documentId, loadData]);

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
                organization={organization}
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
                organization={organization}
                units={units}
                members={members}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            <RevokeAccessDialog
                open={showRevokeDialog}
                policy={policyToRevoke}
                reason={revokeReason}
                onReasonChange={setRevokeReason}
                onCancel={handleCancelRevoke}
                onConfirm={handleConfirmRevoke}
                loading={saving}
            />

        </div>
    );
};

export default DocumentAccess;