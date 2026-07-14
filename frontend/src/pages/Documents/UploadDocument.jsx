// frontend/src/pages/Documents/UploadDocument.jsx

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadDraft } from "../../api/document.api";
import "./UploadDocument.css";

const UploadDocument = () => {
    const { documentId } = useParams();

    const navigate = useNavigate();

    const [selectedFile, setSelectedFile] =
        useState(null);

    const [uploading, setUploading] =
        useState(false);

    const [error, setError] =
        useState("");

    const handleFileSelection = (event) => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        setSelectedFile(file);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError(
                "Please select a document."
            );

            return;
        }

        try {
            setUploading(true);
            setError("");

            await uploadDraft(
                documentId,
                selectedFile
            );

            navigate(
                `/documents/${documentId}`
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Failed to upload document."
            );
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-document-page">

            <div className="upload-document-header">

                <h1>Upload Document</h1>

                <p>
                    Upload the file that belongs
                    to this draft.
                </p>

            </div>

            {error && (
                <div className="upload-error">
                    {error}
                </div>
            )}

            <div className="upload-card">

                <input
                    type="file"
                    onChange={
                        handleFileSelection
                    }
                />

                {selectedFile && (
                    <div className="selected-file">

                        <h3>
                            Selected File
                        </h3>

                        <p>
                            {selectedFile.name}
                        </p>

                        <p>
                            {(
                                selectedFile.size /
                                1024 /
                                1024
                            ).toFixed(2)}
                            {" "}
                            MB
                        </p>

                    </div>
                )}

                <button
                    type="button"
                    className="primary-button"
                    disabled={uploading}
                    onClick={handleUpload}
                >
                    {uploading
                        ? "Uploading..."
                        : "Upload File"}
                </button>

            </div>

        </div>
    );
};

export default UploadDocument;