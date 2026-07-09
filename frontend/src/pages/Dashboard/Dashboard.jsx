import {useEffect,useMemo,useState} from "react";
import {Link} from "react-router-dom";
import api from "../../api/axios";
import "./Dashboard.css";

function Dashboard(){
    const [organization,setOrganization] = useState(null);
    const [organizationUnits,setOrganizationUnits] = useState([]);
    const [organizationMembers,setOrganizationMembers] = useState([]);
    const [organizationRevision,setOrganizationRevision] = useState(null);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");

    useEffect(()=>{
        const fetchDashboardData = async()=>{
            try{
                setError("");

                const [
                    organizationResponse,
                    unitsResponse,
                    membersResponse,
                    revisionResponse
                ] = await Promise.all([
                    api.get("/organization"),
                    api.get("/organization/units"),
                    api.get("/organization/members"),
                    api.get("/organization/revision")
                ]);

                setOrganization(
                    organizationResponse.data.data
                );

                setOrganizationUnits(
                    unitsResponse.data.data
                );

                setOrganizationMembers(
                    membersResponse.data.data
                );

                setOrganizationRevision(
                    revisionResponse.data.data.revision
                );
            }
            catch(error){
                setError(
                    error.response?.data?.message ||
                    "Failed to load dashboard"
                );
            }
            finally{
                setLoading(false);
            }
        };

        fetchDashboardData();
    },[]);

    const unitSummary = useMemo(()=>{
        return organizationUnits.reduce(
            (summary,unit)=>{
                if(unit.type === "DEPARTMENT"){
                    summary.departments++;
                }

                if(unit.type === "TEAM"){
                    summary.teams++;
                }

                if(unit.type === "GROUP"){
                    summary.groups++;
                }

                return summary;
            },
            {
                departments:0,
                teams:0,
                groups:0
            }
        );
    },[organizationUnits]);

    if(loading){
        return (
            <main className="dashboard-page">
                <div className="dashboard-state">
                    <p>Loading dashboard...</p>
                </div>
            </main>
        );
    }

    if(error){
        return (
            <main className="dashboard-page">
                <div className="dashboard-state dashboard-error">
                    <h2>Unable to load dashboard</h2>
                    <p>{error}</p>
                </div>
            </main>
        );
    }

    if(!organization){
        return (
            <main className="dashboard-page">
                <div className="dashboard-state">
                    <p>Organization data not found</p>
                </div>
            </main>
        );
    }

    return (
        <main className="dashboard-page app-page-background">
            <div className="dashboard-container">
                <header className="dashboard-header">
                    <div>
                        <p className="dashboard-eyebrow">
                            Organization Dashboard
                        </p>

                        <h1>
                            {organization.name}
                        </h1>

                        <p className="dashboard-description">
                            {organization.description ||
                                "Manage your organization structure, members and access."
                            }
                        </p>
                    </div>

                    <div className="dashboard-revision">
                        <span>
                            Current Revision
                        </span>

                        <strong>
                            {organizationRevision}
                        </strong>
                    </div>
                </header>

                <section className="dashboard-stats">
                    <article className="dashboard-stat-card">
                        <span className="dashboard-stat-label">
                            Organization Units
                        </span>

                        <strong className="dashboard-stat-value">
                            {organizationUnits.length}
                        </strong>

                        <p>
                            Total units across the organization
                        </p>
                    </article>

                    <article className="dashboard-stat-card">
                        <span className="dashboard-stat-label">
                            Members
                        </span>

                        <strong className="dashboard-stat-value">
                            {organizationMembers.length}
                        </strong>

                        <p>
                            Active organization members
                        </p>
                    </article>

                    <article className="dashboard-stat-card">
                        <span className="dashboard-stat-label">
                            Departments
                        </span>

                        <strong className="dashboard-stat-value">
                            {unitSummary.departments}
                        </strong>

                        <p>
                            Top-level business units
                        </p>
                    </article>

                    <article className="dashboard-stat-card">
                        <span className="dashboard-stat-label">
                            Teams & Groups
                        </span>

                        <strong className="dashboard-stat-value">
                            {unitSummary.teams +
                                unitSummary.groups
                            }
                        </strong>

                        <p>
                            Operational organization units
                        </p>
                    </article>
                </section>

                <div className="dashboard-content-grid">
                    <section className="dashboard-panel">
                        <div className="dashboard-panel-header">
                            <div>
                                <p className="dashboard-panel-eyebrow">
                                    Structure
                                </p>

                                <h2>
                                    Organization Breakdown
                                </h2>
                            </div>

                            <Link
                                className="dashboard-panel-link"
                                to="/organization"
                            >
                                Manage Structure
                            </Link>
                        </div>

                        <div className="dashboard-breakdown">
                            <div className="dashboard-breakdown-item">
                                <div>
                                    <span className="dashboard-breakdown-icon">
                                        D
                                    </span>

                                    <div>
                                        <strong>
                                            Departments
                                        </strong>

                                        <p>
                                            Business divisions
                                        </p>
                                    </div>
                                </div>

                                <span className="dashboard-breakdown-count">
                                    {unitSummary.departments}
                                </span>
                            </div>

                            <div className="dashboard-breakdown-item">
                                <div>
                                    <span className="dashboard-breakdown-icon">
                                        T
                                    </span>

                                    <div>
                                        <strong>
                                            Teams
                                        </strong>

                                        <p>
                                            Department teams
                                        </p>
                                    </div>
                                </div>

                                <span className="dashboard-breakdown-count">
                                    {unitSummary.teams}
                                </span>
                            </div>

                            <div className="dashboard-breakdown-item">
                                <div>
                                    <span className="dashboard-breakdown-icon">
                                        G
                                    </span>

                                    <div>
                                        <strong>
                                            Groups
                                        </strong>

                                        <p>
                                            Team working groups
                                        </p>
                                    </div>
                                </div>

                                <span className="dashboard-breakdown-count">
                                    {unitSummary.groups}
                                </span>
                            </div>
                        </div>
                    </section>

                    <section className="dashboard-panel">
                        <div className="dashboard-panel-header">
                            <div>
                                <p className="dashboard-panel-eyebrow">
                                    Workspace
                                </p>

                                <h2>
                                    Quick Access
                                </h2>
                            </div>
                        </div>

                        <div className="dashboard-quick-links">
                            <Link
                                className="dashboard-quick-link"
                                to="/organization"
                            >
                                <span className="dashboard-quick-icon">
                                    O
                                </span>

                                <div>
                                    <strong>
                                        Organization
                                    </strong>

                                    <p>
                                        Manage units, members and capacity
                                    </p>
                                </div>

                                <span className="dashboard-arrow">
                                    →
                                </span>
                            </Link>

                            <Link
                                className="dashboard-quick-link"
                                to="/permissions"
                            >
                                <span className="dashboard-quick-icon">
                                    P
                                </span>

                                <div>
                                    <strong>
                                        Permissions
                                    </strong>

                                    <p>
                                        Manage scoped access and delegation
                                    </p>
                                </div>

                                <span className="dashboard-arrow">
                                    →
                                </span>
                            </Link>

                            <Link
                                className="dashboard-quick-link"
                                to="/invitations"
                            >
                                <span className="dashboard-quick-icon">
                                    I
                                </span>

                                <div>
                                    <strong>
                                        Invitations
                                    </strong>

                                    <p>
                                        Invite and onboard organization members
                                    </p>
                                </div>

                                <span className="dashboard-arrow">
                                    →
                                </span>
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

export default Dashboard;