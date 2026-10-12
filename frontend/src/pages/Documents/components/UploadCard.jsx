import { useRef } from "react";
import SelectedFileCard from "./SelectedFileCard";

const UploadCard = ({
    selectedFile,
    uploading,
    uploadProgress,
    onFileSelection,
    onUpload,
    onRemove,
    buttonText = "Upload File",
}) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (event) => {
        onFileSelection(event);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="upload-card">

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            <SelectedFileCard
                file={selectedFile}
                onRemove={onRemove}
            />
            {uploading && (
                <div className="upload-progress">

                    <div className="progress-bar">

                        <div
                            className="progress-fill"
                            style={{
                                width: `${uploadProgress}%`,
                            }}
                        />

                    </div>

                    <p>
                        {uploadProgress}% Uploaded
                    </p>

                </div>
            )}
            <button
                type="button"
                className="primary-button"
                disabled={uploading}
                onClick={onUpload}
            >
                {uploading
                    ? "Uploading..."
                    : buttonText}
            </button>

        </div>
    );
};

export default UploadCard;