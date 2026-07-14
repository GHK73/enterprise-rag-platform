import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadDraft } from "../../api/document.api";
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

    const [selectedFile, setSelectedFile] =
        useState(null);

    const [uploading, setUploading] =
        useState(false);

    const [uploadProgress, setUploadProgress] = useState(0);

    const [error, setError] =
        useState("");
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
            setError(
                "Maximum file size is 25 MB."
            );    
            return;
        }        
        setSelectedFile(file);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
    
        setError("");
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

            {error && (
                <div className="upload-error">
                    {error}
                </div>
            )}

            <UploadCard
                selectedFile={selectedFile}
                uploading={uploading}
                uploadProgress={uploadProgress}
                onFileSelection={handleFileSelection}
                onUpload={handleUpload}
                onRemove={handleRemoveFile}
                buttonText="Upload Draft"
            />
        </div>
    );
};

export default UploadDocument;