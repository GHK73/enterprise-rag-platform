// frontend/src/pages/Organization/Organization.jsx

import {useEffect,useState} from "react";
import api from "../../api/axios";
import "./Organization.css";

function Organization(){
    const [organization,setOrganization] = useState(null);
    const [organizationUnits,setOrganizationUnits] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");
    const [name,setName] = useState("");
    const [creating,setCreating] = useState(false);
    const [message,setMessage] = useState("");

    useEffect(()=>{
        const fetchOrganizationData = async()=>{
            try{
                const [organizationResponse,unitsResponse] = await Promise.all([
                    api.get("/organization"),
                    api.get("/organization/units")
                ]);

                setOrganization(organizationResponse.data.data);
                setOrganizationUnits(unitsResponse.data.data);
            }
            catch(error){
                setError(
                    error.response?.data?.message ||
                    "Failed to fetch organization data"
                );
            }
            finally{
                setLoading(false);
            }
        };

        fetchOrganizationData();
    },[]);

    const handleCreateDepartment = async(e)=>{
        e.preventDefault();

        const rootUnit = organizationUnits.find(
            (unit)=>unit.type === "COMPANY"
        );

        if(!rootUnit){
            setError("Company unit not found");
            return;
        }

        try{
            setCreating(true);
            setError("");
            setMessage("");

            const response = await api.post(
                "/organization/units",
                {
                    name,
                    type: "DEPARTMENT",
                    parentId: rootUnit.id
                }
            );

            setOrganizationUnits((currentUnits)=>[
                ...currentUnits,
                response.data.data
            ]);

            setName("");
            setMessage("Department created successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to create department"
            );
        }
        finally{
            setCreating(false);
        }
    };

    if(loading){
        return (
            <div className="organization-state">
                <p>Loading organization...</p>
            </div>
        );
    }

    if(error && !organization){
        return (
            <div className="organization-state organization-error">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <main className="organization-page">
            <div className="organization-container">
                <header className="organization-header">
                    <p className="organization-eyebrow">
                        Organization Management
                    </p>

                    <h1>{organization.name}</h1>

                    <p className="organization-description">
                        {organization.description || "No description"}
                    </p>
                </header>

                <section className="organization-section">
                    <div className="organization-section-header">
                        <div>
                            <h2>Organization Structure</h2>

                            <p>
                                View the departments, teams, and groups
                                within your organization.
                            </p>
                        </div>
                    </div>

                    <form
                        className="organization-create-form"
                        onSubmit={handleCreateDepartment}
                    >
                        <div className="organization-form-field">
                            <label htmlFor="department-name">
                                Create Department
                            </label>

                            <input
                                id="department-name"
                                type="text"
                                placeholder="e.g. Engineering"
                                value={name}
                                onChange={(e)=>setName(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            className="organization-create-button"
                            type="submit"
                            disabled={creating}
                        >
                            {creating ? "Creating..." : "Add Department"}
                        </button>
                    </form>

                    {message && (
                        <p className="organization-success">
                            {message}
                        </p>
                    )}

                    {error && (
                        <p className="organization-form-error">
                            {error}
                        </p>
                    )}

                    <div className="organization-units">
                        {organizationUnits.map((unit)=>(
                            <article
                                className="organization-unit-card"
                                key={unit.id}
                            >
                                <div className="organization-unit-icon">
                                    {unit.name.charAt(0).toUpperCase()}
                                </div>

                                <div className="organization-unit-content">
                                    <h3>{unit.name}</h3>

                                    <span className="organization-unit-type">
                                        {unit.type}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}

export default Organization;