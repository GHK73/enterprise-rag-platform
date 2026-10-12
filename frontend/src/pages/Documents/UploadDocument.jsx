import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadDraft, deleteDraftUpload, getDocumentById } from "../../api/document.api";
import UploadCard from "./components/UploadCard";
import "./UploadDocument.css";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const UploadDocument = () => {
    const { documentId } = useParams();

    const navigate = useNavigate();

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [document, setDocument] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [removing, setRemoving] = useState(false);

    const hasUploadedFile = Boolean(document?.currentVersionId);

    useEffect(() => {
        const loadDraft = async () => {
            try {
                setLoading(true);
                setError("");
                const response = await getDocumentById(
                    documentId,
                    true
                );
                setDocument(response);
            } catch (err) {
                setError(
                    err?.response?.data?.message ||
                        "Failed to load draft."
                );
            } finally {
                setLoading(false);
            }
        };

        loadDraft();
    }, [documentId]);

    const handleFileSelection = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        setError("");
        if (!ALLOWED_TYPES.includes(file.type)) {
            setSelectedFile(null);
            setError(
                "Only PDF, TXT, DOC and DOCX files are supported."
            );
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setSelectedFile(null);
            setError("Maximum file size is 25 MB.");
            return;
        }
        setSelectedFile(file);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setError("");
    };

    const handleRemoveUploadedFile = async () => {
        try {
            setRemoving(true);
            setError("");
            await deleteDraftUpload(documentId);
            const response = await getDocumentById(
                documentId,
                true
            );
            setDocument(response);
            setSelectedFile(null);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to remove uploaded file."
            );
        } finally {
            setRemoving(false);
        }
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
            setUploadProgress(0);
            setError("");

            await uploadDraft(
                documentId,
                selectedFile,
                (progressEvent) => {
                    const progress = Math.round(
                        (progressEvent.loaded * 100) /
                        progressEvent.total
                    );
            
                    setUploadProgress(progress);
                },
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
            setUploadProgress(0);
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

            {document && (
                <div className="upload-document-info">
                    <p>
                        <strong>Title:</strong>{" "}
                        {document.title}
                    </p>
                    {document.status && (
                        <p>
                            <strong>Status:</strong>{" "}
                            {document.status}
                        </p>
                    )}
                    {document.draftExpiresAt && (
                        <p>
                            <strong>Draft expires:</strong>{" "}
                            {new Date(
                                document.draftExpiresAt
                            ).toLocaleString()}
                        </p>
                    )}
                    {hasUploadedFile && (
                        <div className="upload-existing-file">
                            <p>
                                This draft already has an uploaded
                                file.
                            </p>
                            <button
                                type="button"
                                onClick={
                                    handleRemoveUploadedFile
                                }
                                disabled={removing || uploading}
                                className="secondary"
                            >
                                {removing
                                    ? "Removing..."
                                    : "Remove Uploaded File"}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="upload-error">
                    {error}
                </div>
            )}

            {!loading && (
                <UploadCard
                    selectedFile={selectedFile}
                    uploading={uploading}
                    uploadProgress={uploadProgress}
                    onFileSelection={handleFileSelection}
                    onUpload={handleUpload}
                    onRemove={handleRemoveFile}
                    buttonText={
                        hasUploadedFile
                            ? "Replace File"
                            : "Upload Draft"
                    }
                />
            )}
        </div>
    );
};

export default UploadDocument;