// frontend/src/pages/Invitations/Invitations.jsx

import {useContext, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import api from "../../api/axios";
import {AuthContext} from "../../context/AuthContext";
import "./Invitations.css";

const Invitations = () => {
    const {
        user,
        refreshUser
    } = useContext(AuthContext);

    const navigate = useNavigate();

    const [invitations,setInvitations] = useState([]);
    const [organizationUnits,setOrganizationUnits] = useState([]);
    const [email,setEmail] = useState("");
    const [unitId,setUnitId] = useState("");
    const [role,setRole] = useState("MEMBER");
    const [loading,setLoading] = useState(true);
    const [submitting,setSubmitting] = useState(false);
    const [acceptingId,setAcceptingId] = useState(null);
    const [error,setError] = useState("");
    const [message,setMessage] = useState("");

    const hasOrganization = Boolean(user?.unitId);

    useEffect(()=>{
        const fetchInvitationData = async()=>{
            if(!user){
                return;
            }

            try{
                setLoading(true);
                setError("");

                if(hasOrganization){
                    const [
                        invitationsResponse,
                        organizationUnitsResponse
                    ] = await Promise.all([
                        api.get("/invitations"),
                        api.get("/organization/units")
                    ]);

                    setInvitations(
                        invitationsResponse.data.data || []
                    );

                    setOrganizationUnits(
                        organizationUnitsResponse.data.data || []
                    );
                }
                else{
                    const response = await api.get(
                        "/invitations/received"
                    );

                    setInvitations(
                        response.data.data || []
                    );
                }
            }
            catch(error){
                setError(
                    error.response?.data?.message ||
                    "Failed to fetch invitation data"
                );
            }
            finally{
                setLoading(false);
            }
        };

        fetchInvitationData();
    },[user,hasOrganization]);

    const handleSubmit = async(e)=>{
        e.preventDefault();

        try{
            setSubmitting(true);
            setError("");
            setMessage("");

            const response = await api.post(
                "/invitations",
                {
                    email,
                    unitId,
                    role
                }
            );

            setInvitations((currentInvitations)=>[
                response.data.data,
                ...currentInvitations
            ]);

            setEmail("");
            setUnitId("");
            setRole("MEMBER");

            setMessage(
                "Invitation created successfully"
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to create invitation"
            );
        }
        finally{
            setSubmitting(false);
        }
    };

    const handleAccept = async(invitation)=>{
        try{
            setAcceptingId(invitation.id);
            setError("");
            setMessage("");

            await api.patch(
                `/invitations/accept/${invitation.token}`
            );

            await refreshUser();

            navigate("/dashboard");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to accept invitation"
            );
        }
        finally{
            setAcceptingId(null);
        }
    };

    if(loading){
        return (
            <main className="invitations-page">
                <p className="invitations-state">
                    Loading invitations...
                </p>
            </main>
        );
    }

    if(!hasOrganization){
        return (
            <main className="invitations-page">
                <section className="invitations-header">
                    <p className="invitations-eyebrow">
                        Organization Access
                    </p>

                    <h1>Received Invitations</h1>

                    <p>
                        View and accept invitations to join
                        an organization.
                    </p>
                </section>

                {error && (
                    <p className="invitations-error">
                        {error}
                    </p>
                )}

                {invitations.length === 0 ? (
                    <div className="invitations-empty">
                        <p>
                            You do not have any pending invitations.
                        </p>
                    </div>
                ) : (
                    <div className="invitation-list">
                        {invitations.map((invitation)=>(
                            <article
                                className="invitation-card"
                                key={invitation.id}
                            >
                                <div className="invitation-card-header">
                                    <div>
                                        <h3>
                                            {invitation.organization.name}
                                        </h3>

                                        <p>
                                            {invitation.unit.name}
                                            {" · "}
                                            {invitation.role}
                                        </p>

                                        <p>
                                            Invited by{" "}
                                            {invitation.invitedBy.fullName}
                                        </p>
                                    </div>

                                    <span className="invitation-status">
                                        {invitation.status}
                                    </span>
                                </div>

                                <button
                                    className="invitation-submit"
                                    type="button"
                                    disabled={
                                        acceptingId === invitation.id
                                    }
                                    onClick={()=>
                                        handleAccept(invitation)
                                    }
                                >
                                    {acceptingId === invitation.id
                                        ? "Accepting..."
                                        : "Accept Invitation"}
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </main>
        );
    }

    return (
        <main className="invitations-page">
            <section className="invitations-header">
                <p className="invitations-eyebrow">
                    Member Access
                </p>

                <h1>Invitations</h1>

                <p>
                    Invite users to join organization units
                    and manage invitation status.
                </p>
            </section>

            <section className="invitation-form-card">
                <h2>Invite Member</h2>

                <form
                    className="invitation-form"
                    onSubmit={handleSubmit}
                >
                    <div className="invitation-field">
                        <label htmlFor="email">
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e)=>setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="invitation-field">
                        <label htmlFor="unitId">
                            Organization Unit
                        </label>

                        <select
                            id="unitId"
                            value={unitId}
                            onChange={(e)=>setUnitId(e.target.value)}
                            required
                        >
                            <option value="">
                                Select organization unit
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

                    <div className="invitation-field">
                        <label htmlFor="role">
                            Role
                        </label>

                        <select
                            id="role"
                            value={role}
                            onChange={(e)=>setRole(e.target.value)}
                        >
                            <option value="MEMBER">
                                MEMBER
                            </option>

                            <option value="MANAGER">
                                MANAGER
                            </option>

                            <option value="ADMIN">
                                ADMIN
                            </option>
                        </select>
                    </div>

                    <button
                        className="invitation-submit"
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting
                            ? "Sending..."
                            : "Create Invitation"}
                    </button>
                </form>

                {message && (
                    <p className="invitations-success">
                        {message}
                    </p>
                )}

                {error && (
                    <p className="invitations-error">
                        {error}
                    </p>
                )}
            </section>

            <section className="invitation-list-section">
                <h2>Invitation History</h2>

                {invitations.length === 0 ? (
                    <div className="invitations-empty">
                        <p>No invitations found.</p>
                    </div>
                ) : (
                    <div className="invitation-list">
                        {invitations.map((invitation)=>(
                            <article
                                className="invitation-card"
                                key={invitation.id}
                            >
                                <div className="invitation-card-header">
                                    <div>
                                        <h3>{invitation.email}</h3>

                                        <p>
                                            {invitation.unit.name}
                                            {" · "}
                                            {invitation.role}
                                        </p>
                                    </div>

                                    <span className="invitation-status">
                                        {invitation.status}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
};

export default Invitations;