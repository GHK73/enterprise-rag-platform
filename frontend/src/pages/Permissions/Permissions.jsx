// frontend/src/pages/Permissions/Permissions.jsx

import {useEffect, useState} from "react";
import api from "../../api/axios";
import "./Permissions.css";

const permissionOptions = [
    "INVITE_MEMBER",
    "REMOVE_MEMBER",
    "UPDATE_MEMBER",
    "ASSIGN_ROLE",
    "MOVE_MEMBER",
    "CREATE_UNIT",
    "UPDATE_UNIT",
    "DELETE_UNIT",
    "MOVE_UNIT"
];

const Permissions = () => {
    const [permissionGrants,setPermissionGrants] = useState([]);
    const [organizationMembers,setOrganizationMembers] = useState([]);
    const [organizationUnits,setOrganizationUnits] = useState([]);

    const [recipientId,setRecipientId] = useState("");
    const [permission,setPermission] = useState("");
    const [scopeUnitId,setScopeUnitId] = useState("");
    const [canDelegate,setCanDelegate] = useState(false);

    const [selectedMemberId,setSelectedMemberId] = useState("");
    const [memberPermissionGrants,setMemberPermissionGrants] = useState([]);

    const [loading,setLoading] = useState(true);
    const [submitting,setSubmitting] = useState(false);
    const [memberPermissionsLoading,setMemberPermissionsLoading] = useState(false);
    const [revokingId,setRevokingId] = useState(null);

    const [error,setError] = useState("");
    const [message,setMessage] = useState("");

    useEffect(()=>{
        const fetchPermissionData = async()=>{
            try{
                setLoading(true);
                setError("");

                const [
                    permissionsResponse,
                    membersResponse,
                    unitsResponse
                ] = await Promise.all([
                    api.get("/permissions/me"),
                    api.get("/organization/members"),
                    api.get("/organization/units")
                ]);

                setPermissionGrants(
                    permissionsResponse.data.data || []
                );

                setOrganizationMembers(
                    membersResponse.data.data || []
                );

                setOrganizationUnits(
                    unitsResponse.data.data || []
                );
            }
            catch(error){
                setError(
                    error.response?.data?.message ||
                    "Failed to fetch permission data"
                );
            }
            finally{
                setLoading(false);
            }
        };

        fetchPermissionData();
    },[]);

    const handleMemberSelection = async(memberId)=>{
        setSelectedMemberId(memberId);
        setMemberPermissionGrants([]);
        setError("");
        setMessage("");

        if(!memberId){
            return;
        }

        try{
            setMemberPermissionsLoading(true);

            const response = await api.get(
                `/permissions/members/${memberId}`
            );

            setMemberPermissionGrants(
                response.data.data || []
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to fetch member permissions"
            );
        }
        finally{
            setMemberPermissionsLoading(false);
        }
    };

    const handleGrantPermission = async(e)=>{
        e.preventDefault();

        try{
            setSubmitting(true);
            setError("");
            setMessage("");

            const response = await api.post(
                "/permissions",
                {
                    recipientId,
                    permission,
                    scopeUnitId,
                    canDelegate
                }
            );

            if(recipientId === selectedMemberId){
                setMemberPermissionGrants((currentGrants)=>[
                    response.data.data,
                    ...currentGrants
                ]);
            }

            setRecipientId("");
            setPermission("");
            setScopeUnitId("");
            setCanDelegate(false);

            setMessage(
                "Permission granted successfully"
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to grant permission"
            );
        }
        finally{
            setSubmitting(false);
        }
    };

    const handleRevokePermission = async(permissionGrantId)=>{
        try{
            setRevokingId(permissionGrantId);
            setError("");
            setMessage("");

            const response = await api.patch(
                `/permissions/${permissionGrantId}/revoke`
            );

            setMemberPermissionGrants((currentGrants)=>
                currentGrants.map((permissionGrant)=>
                    permissionGrant.id === permissionGrantId
                        ? {
                            ...permissionGrant,
                            isActive: false,
                            revokedAt:
                                response.data.data.revokedAt ||
                                new Date().toISOString()
                        }
                        : permissionGrant
                )
            );

            setMessage(
                "Permission revoked successfully"
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to revoke permission"
            );
        }
        finally{
            setRevokingId(null);
        }
    };

    if(loading){
        return (
            <main className="permissions-page">
                <p className="permissions-state">
                    Loading permissions...
                </p>
            </main>
        );
    }

    return (
        <main className="permissions-page">
            <section className="permissions-header">
                <div>
                    <p className="permissions-eyebrow">
                        Access Management
                    </p>

                    <h1>Permissions</h1>

                    <p>
                        View your current access and grant
                        permissions within your delegation scope.
                    </p>
                </div>
            </section>

            <section className="permission-grant-section">
                <h2>Grant Permission</h2>

                <form
                    className="permission-grant-form"
                    onSubmit={handleGrantPermission}
                >
                    <div className="permission-field">
                        <label htmlFor="recipientId">
                            Member
                        </label>

                        <select
                            id="recipientId"
                            value={recipientId}
                            onChange={(e)=>
                                setRecipientId(e.target.value)
                            }
                            required
                        >
                            <option value="">
                                Select member
                            </option>

                            {organizationMembers.map((member)=>(
                                <option
                                    key={member.id}
                                    value={member.id}
                                >
                                    {member.fullName}
                                    {" — "}
                                    {member.unit.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="permission-field">
                        <label htmlFor="permission">
                            Permission
                        </label>

                        <select
                            id="permission"
                            value={permission}
                            onChange={(e)=>
                                setPermission(e.target.value)
                            }
                            required
                        >
                            <option value="">
                                Select permission
                            </option>

                            {permissionOptions.map((permissionOption)=>(
                                <option
                                    key={permissionOption}
                                    value={permissionOption}
                                >
                                    {permissionOption}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="permission-field">
                        <label htmlFor="scopeUnitId">
                            Scope
                        </label>

                        <select
                            id="scopeUnitId"
                            value={scopeUnitId}
                            onChange={(e)=>
                                setScopeUnitId(e.target.value)
                            }
                            required
                        >
                            <option value="">
                                Select scope
                            </option>

                            {organizationUnits.map((organizationUnit)=>(
                                <option
                                    key={organizationUnit.id}
                                    value={organizationUnit.id}
                                >
                                    {organizationUnit.name}
                                    {" — "}
                                    {organizationUnit.type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="permission-checkbox">
                        <input
                            type="checkbox"
                            checked={canDelegate}
                            onChange={(e)=>
                                setCanDelegate(e.target.checked)
                            }
                        />

                        Can Delegate
                    </label>

                    <button
                        className="permission-submit"
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting
                            ? "Granting..."
                            : "Grant Permission"}
                    </button>
                </form>
            </section>

            {message && (
                <p className="permissions-success">
                    {message}
                </p>
            )}

            {error && (
                <p className="permissions-error">
                    {error}
                </p>
            )}

            <section className="member-permissions-section">
                <div className="member-permissions-header">
                    <div>
                        <h2>Member Permissions</h2>

                        <p>
                            View active and revoked permission grants
                            for an organization member.
                        </p>
                    </div>

                    <select
                        value={selectedMemberId}
                        onChange={(e)=>
                            handleMemberSelection(e.target.value)
                        }
                    >
                        <option value="">
                            Select member
                        </option>

                        {organizationMembers.map((member)=>(
                            <option
                                key={member.id}
                                value={member.id}
                            >
                                {member.fullName}
                                {" — "}
                                {member.unit.name}
                            </option>
                        ))}
                    </select>
                </div>

                {memberPermissionsLoading && (
                    <p className="member-permissions-state">
                        Loading member permissions...
                    </p>
                )}

                {!memberPermissionsLoading &&
                    selectedMemberId &&
                    memberPermissionGrants.length === 0 && (
                        <div className="permissions-empty">
                            <p>
                                This member has no permission history.
                            </p>
                        </div>
                    )}

                {!memberPermissionsLoading &&
                    memberPermissionGrants.length > 0 && (
                        <div className="permissions-grid">
                            {memberPermissionGrants.map((permissionGrant)=>(
                                <article
                                    className="permission-card"
                                    key={permissionGrant.id}
                                >
                                    <div className="permission-card-header">
                                        <h3>
                                            {permissionGrant.permission}
                                        </h3>

                                        <span
                                            className={
                                                permissionGrant.isActive
                                                    ? "permission-status"
                                                    : "permission-status permission-status-revoked"
                                            }
                                        >
                                            {permissionGrant.isActive
                                                ? "Active"
                                                : "Revoked"}
                                        </span>
                                    </div>

                                    <div className="permission-details">
                                        <div>
                                            <span>Scope</span>

                                            <strong>
                                                {permissionGrant.scopeUnit.name}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Granted By</span>

                                            <strong>
                                                {permissionGrant.grantedBy.fullName}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Can Delegate</span>

                                            <strong>
                                                {permissionGrant.canDelegate
                                                    ? "Yes"
                                                    : "No"}
                                            </strong>
                                        </div>

                                        {!permissionGrant.isActive && (
                                            <div>
                                                <span>Revoked At</span>

                                                <strong>
                                                    {permissionGrant.revokedAt
                                                        ? new Date(
                                                            permissionGrant.revokedAt
                                                        ).toLocaleDateString()
                                                        : "—"}
                                                </strong>
                                            </div>
                                        )}
                                    </div>

                                    {permissionGrant.isActive && (
                                        <button
                                            className="permission-revoke"
                                            type="button"
                                            disabled={
                                                revokingId ===
                                                permissionGrant.id
                                            }
                                            onClick={()=>
                                                handleRevokePermission(
                                                    permissionGrant.id
                                                )
                                            }
                                        >
                                            {revokingId === permissionGrant.id
                                                ? "Revoking..."
                                                : "Revoke Permission"}
                                        </button>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
            </section>

            <section className="my-permissions-section">
                <h2>My Permissions</h2>

                {permissionGrants.length === 0 ? (
                    <section className="permissions-empty">
                        <p>
                            You do not currently have any active
                            permission grants.
                        </p>
                    </section>
                ) : (
                    <div className="permissions-grid">
                        {permissionGrants.map((permissionGrant)=>(
                            <article
                                className="permission-card"
                                key={permissionGrant.id}
                            >
                                <div className="permission-card-header">
                                    <h3>
                                        {permissionGrant.permission}
                                    </h3>

                                    <span className="permission-status">
                                        Active
                                    </span>
                                </div>

                                <div className="permission-details">
                                    <div>
                                        <span>Scope</span>

                                        <strong>
                                            {permissionGrant.scopeUnit.name}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Unit Type</span>

                                        <strong>
                                            {permissionGrant.scopeUnit.type}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Granted By</span>

                                        <strong>
                                            {permissionGrant.grantedBy.fullName}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Can Delegate</span>

                                        <strong>
                                            {permissionGrant.canDelegate
                                                ? "Yes"
                                                : "No"}
                                        </strong>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
};

export default Permissions;