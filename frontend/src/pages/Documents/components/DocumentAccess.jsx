import { useEffect, useState } from "react";

import {
    getDocumentAccessPolicies,
    grantDocumentAccess,
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

    const loadAccessPolicies =
        async () => {
            try {
                const response =
                    await getDocumentAccessPolicies(
                        documentId
                    );

                setPolicies(response);
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
                    unitsResponse.data.data ||
                        []
                );

                setMembers(
                    membersResponse.data.data ||
                        []
                );
            } catch {
                setUnits([]);

                setMembers([]);
            }
        };

    const loadData = async () => {
        try {
            setLoading(true);

            setError("");

            await Promise.all([
                loadAccessPolicies(),
                loadOrganizationData(),
            ]);
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

    const handleGrantAccess =
        async (accessData) => {
            try {
                setSaving(true);

                await grantDocumentAccess(
                    documentId,
                    accessData
                );

                await loadAccessPolicies();
            } catch (err) {
                setError(
                    err?.response?.data
                        ?.message ||
                        "Failed to grant access."
                );
            } finally {
                setSaving(false);
            }
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
                await revokeDocumentAccess(
                    policy.id,
                    "Removed from frontend"
                );

                await loadAccessPolicies();
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
            <p>
                Loading access policies...
            </p>
        );
    }

    return (
        <div className="document-card">

            <h2>
                Access Management
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
                onSubmit={
                    handleGrantAccess
                }
            />

            <AccessPolicyTable
                policies={policies}
                onEdit={() => {}}
                onDelete={
                    handleDelete
                }
            />

        </div>
    );
};

export default DocumentAccess;