// frontend/src/pages/Dashboard/Dashboard.jsx

import {useEffect,useState} from "react";
import api from "../../api/axios";

function Dashboard(){
    const [organization,setOrganization] = useState(null);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");
    const [name,setName] = useState("");
    const [description,setDescription] = useState("");
    const [message,setMessage] = useState("");

    useEffect(()=>{
        const fetchOrganization = async()=>{
            try{
                const response = await api.get("/organization");

                setOrganization(response.data.data);
                setName(response.data.data.name);
                setDescription(response.data.data.description || "");
            }
            catch(error){
                setError(
                    error.response?.data?.message ||
                    "Failed to fetch organization"
                );
            }
            finally{
                setLoading(false);
            }
        };

        fetchOrganization();
    },[]);

    const handleUpdate = async(e)=>{
        e.preventDefault();

        try{
            setError("");
            setMessage("");

            const response = await api.patch(
                "/organization",
                {
                    name,
                    description
                }
            );

            setOrganization(response.data.data);
            setMessage("Organization updated successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to update organization"
            );
        }
    };

    if(loading){
        return <p>Loading organization...</p>;
    }

    if(error && !organization){
        return <p>{error}</p>;
    }

    if(!organization){
        return <p>Organization data not found</p>;
    }

    return (
        <div>
            <h1>Dashboard</h1>

            <h2>{organization.name}</h2>

            <p>
                {organization.description || "No description"}
            </p>

            <h2>Update Organization</h2>

            <form onSubmit={handleUpdate}>
                <div>
                    <label>Organization Name</label>

                    <input
                        type="text"
                        value={name}
                        onChange={(e)=>setName(e.target.value)}
                    />
                </div>

                <div>
                    <label>Description</label>

                    <textarea
                        value={description}
                        onChange={(e)=>setDescription(e.target.value)}
                    />
                </div>

                <button type="submit">
                    Update Organization
                </button>
            </form>

            {message && <p>{message}</p>}
            {error && <p>{error}</p>}
        </div>
    );
}

export default Dashboard;