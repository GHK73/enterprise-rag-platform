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
    return (
        <div className="upload-card">

            <input
                type="file"
                onChange={onFileSelection}
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