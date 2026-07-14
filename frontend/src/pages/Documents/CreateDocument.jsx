import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDocumentDraft } from "../../api/document.api";
import "./CreateDocument.css";

const CreateDocument = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        classification: "",
    });

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleCreateDraft = async (event) => {
        event.preventDefault();

        try {
            setLoading(true);
            setError("");

            const createdDraft = await createDocumentDraft(
                formData
            );

            navigate(
                `/documents/${createdDraft.id}/upload`
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Unable to create document draft."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-document-page">
            <div className="create-document-header">
                <h1>Create Document</h1>

                <p>
                    Create a document draft before
                    uploading the document file.
                </p>
            </div>

            {error && (
                <div className="create-document-error">
                    {error}
                </div>
            )}

            <form
                className="draft-form"
                onSubmit={handleCreateDraft}
            >
                <div className="form-group">
                    <label>Document Title</label>

                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Annual Financial Report"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Description</label>

                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Short document description..."
                    />
                </div>

                <div className="form-group">
                    <label>Classification</label>

                    <select
                        name="classification"
                        value={formData.classification}
                        onChange={handleChange}
                        required
                    >
                        <option value="">
                            Select Classification
                        </option>

                        <option value="PUBLIC">
                            Public
                        </option>

                        <option value="INTERNAL">
                            Internal
                        </option>

                        <option value="CONFIDENTIAL">
                            Confidential
                        </option>

                        <option value="RESTRICTED">
                            Restricted
                        </option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                >
                    {loading
                        ? "Creating Draft..."
                        : "Create Draft"}
                </button>
            </form>
        </div>
    );
};

export default CreateDocument;