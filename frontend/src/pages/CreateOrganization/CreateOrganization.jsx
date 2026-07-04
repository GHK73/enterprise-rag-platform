// frontend/src/pages/CreateOrganization/CreateOrganization.jsx

import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "./CreateOrganization.css";
import { AuthContext } from "../../context/AuthContext";

function CreateOrganization() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { refreshUser } = useContext(AuthContext);

    async function handleSubmit(e) {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            await api.post("/organization", {
                name,
                description,
            });
        
            await refreshUser();
        
            navigate("/dashboard");
        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Failed to create organization"
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="create-organization-page">
            <div className="create-organization-container">
                <div className="create-organization-header">
                    <span className="create-organization-label">
                        Workspace Setup
                    </span>

                    <h1>Create your organization</h1>

                    <p>
                        Set up your organization workspace to start
                        managing teams, documents, and enterprise knowledge.
                    </p>
                </div>

                <form
                    className="create-organization-form"
                    onSubmit={handleSubmit}
                >
                    {error && (
                        <div className="create-organization-error">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">
                            Organization Name
                        </label>

                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter organization name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">
                            Description
                        </label>

                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) =>
                                setDescription(e.target.value)
                            }
                            placeholder="Describe your organization"
                            rows="4"
                        />
                    </div>

                    <button
                        type="submit"
                        className="create-organization-button"
                        disabled={loading}
                    >
                        {loading
                            ? "Creating Organization..."
                            : "Create Organization"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CreateOrganization;