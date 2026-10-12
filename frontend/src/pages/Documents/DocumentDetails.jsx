import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getDocumentById,
    publishDocumentDraft,
    downloadDocument,
    getDocumentVersions,
    uploadDocumentVersion,
    deleteDocument,
    restoreDocument,
    cleanupDeletedDocument,
} from "../../api/document.api";
import { useNavigate } from "react-router-dom";

import DeleteDocumentDialog from "./components/DeleteDocumentDialog";
import PublishConfirmationDialog from "./components/PublishConfirmationDialog.jsx";
import { deleteDraftUpload } from "../../api/document.api";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const DocumentDetails = () => {
    const { documentId } = useParams();
    const navigate = useNavigate();

    const [document, setDocument] =
        useState(null);

    const [versions, setVersions] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [publishing, setPublishing] =
        useState(false);

    const [downloading, setDownloading] =
        useState(false);

    const [uploadingVersion, setUploadingVersion] =
        useState(false);

    const [selectedVersionFile, setSelectedVersionFile] =
        useState(null);

    const [versionUploadProgress, setVersionUploadProgress] =
        useState(0);

    const [showUploadSection, setShowUploadSection] =
        useState(false);

    const [pageError, setPageError] =
        useState("");
    const [
        deleting,
        setDeleting,
    ] = useState(false);

    const [
        showDeleteDialog,
        setShowDeleteDialog,
    ] = useState(false);

    const [
        showRestoreDialog,
        setShowRestoreDialog,
    ] = useState(false);

    const [
        showCleanupDialog,
        setShowCleanupDialog,
    ] = useState(false);

    const [showPublishDialog, setShowPublishDialog] =
        useState(false);

    const [removingFile, setRemovingFile] = useState(false);

    const loadDocument = async (includeDeleted = false) => {
        try {
            setLoading(true);

            setPageError("");

            const response =
                await getDocumentById(
                    documentId,
                    includeDeleted
                );

            setDocument(response);
        } catch (err) {
            // If not found and not already trying with includeDeleted, retry with includeDeleted
            if (err.response?.status === 404 && !includeDeleted) {
                return loadDocument(true);
            }
            setPageError(
                err?.response?.data?.message ||
                    "Failed to load document."
            );
        } finally {
            setLoading(false);
        }
    };

    const loadVersions = async () => {
        try {
            const response =
                await getDocumentVersions(
                    documentId
                );

            setVersions(response || []);
        } catch {
            setVersions([]);
        }
    };
    const handlePublish = async () => {
        try {
            setPublishing(true);

            setActionError("");

            await publishDocumentDraft(
                documentId
            );

            await loadDocument();

            await loadVersions();
            setShowPublishDialog(false);
        } catch (err) {
            setActionError(
                err?.response?.data?.message ||
                    "Failed to publish document."
            );
        } finally {
            setPublishing(false);
        }
    };

    const handlePublishClick = () => {
        setShowPublishDialog(true);
    };

    const handleCancelPublish = () => {
        setShowPublishDialog(false);
    };

    const handleDownload = async () => {
        try {
            setDownloading(true);

            setActionError("");

            const response =
                await downloadDocument(
                    documentId
                );

            window.open(
                response.downloadUrl,
                "_blank"
            );
        } catch (err) {
            setActionError(
                err?.response?.data?.message ||
                    "Failed to download document."
            );
        } finally {
            setDownloading(false);
        }
    };

    const handleRemoveDraftFile = async () => {
        try {
            setRemovingFile(true);
            setActionError("");
            await deleteDraftUpload(documentId);
            await loadDocument();
            await loadVersions();
        } catch (err) {
            setActionError(
                err?.response?.data?.message ||
                    "Failed to remove uploaded file."
            );
        } finally {
            setRemovingFile(false);
        }
    };
    
    const handleDelete =
    async () => {
        try {

            setDeleting(true);

            await deleteDocument(
                documentId
            );

            setShowDeleteDialog(
                false
            );

            await loadDocument(true);

        } catch (err) {

            setActionError(
                err?.response?.data
                    ?.message ||
                    "Failed to delete document."
            );

        } finally {

            setDeleting(false);

        }
    };

const handleRestore =
    async () => {
        try {

            setDeleting(true);

            await restoreDocument(
                documentId
            );

            setShowRestoreDialog(
                false
            );

            await loadDocument(true);

        } catch (err) {

            setActionError(
                err?.response?.data
                    ?.message ||
                    "Failed to restore document."
            );

        } finally {

            setDeleting(false);

        }
    };

const handleCleanup =
    async () => {
        try {

            setDeleting(true);

            await cleanupDeletedDocument(
                documentId
            );

            navigate("/documents");

        } catch (err) {

            setActionError(
                err?.response?.data
                    ?.message ||
                    "Failed to permanently delete document."
            );

        } finally {

            setDeleting(false);

        }
    };

    const handleVersionFileSelection = (
        event
    ) => {
        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        setActionError("");

        if (
            !ALLOWED_TYPES.includes(
                file.type
            )
        ) {
            setSelectedVersionFile(null);

            setActionError(
                "Only PDF, TXT, DOC and DOCX files are supported."
            );

            return;
        }

        if (
            file.size >
            MAX_FILE_SIZE
        ) {
            setSelectedVersionFile(null);

            setActionError(
                "Maximum file size is 25 MB."
            );

            return;
        }

        setSelectedVersionFile(file);
    };

    const handleRemoveVersionFile = () => {
        setSelectedVersionFile(null);

        setActionError("");
    };

    const handleUploadVersion = async () => {
        if (!selectedVersionFile) {
            setActionError(
                "Please select a file."
            );

            return;
        }

        try {
            setUploadingVersion(true);

            setActionError("");

            setVersionUploadProgress(0);

            await uploadDocumentVersion(
                documentId,
                selectedVersionFile,
                (progressEvent) => {
                    const progress =
                        Math.round(
                            (progressEvent.loaded *
                                100) /
                                progressEvent.total
                        );

                    setVersionUploadProgress(
                        progress
                    );
                }
            );

            setSelectedVersionFile(
                null
            );

            setVersionUploadProgress(0);

            setShowUploadSection(
                false
            );

            await Promise.all([
                loadDocument(),
                loadVersions(),
            ]);
        } catch (err) {
            setActionError(
                err?.response?.data?.message ||
                    "Failed to upload new version."
            );
        } finally {
            setUploadingVersion(false);
        }
    };

    useEffect(() => {
        loadDocument();
        loadVersions();
        setShowUploadSection(false);
        setSelectedVersionFile(null);
        setVersionUploadProgress(0);
        setActionError("");
    }, [documentId]);

    useEffect(() => {
        if (
            !document ||
            document.status === "READY" ||
            document.status === "FAILED" ||
            document.status === "DELETED" ||
            document.status === "EXPIRED"
        ) {
            return;
        }

        const interval = setInterval(() => {
            loadDocument(true);
            loadVersions();
        }, 3000);

        return () => {
            clearInterval(interval);
        };
    }, [document]);
    if (loading) {
        return (
            <div className="document-details-page">
                Loading document...
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="document-details-page">

                <div className="document-error">
                    {pageError}
                </div>

            </div>
        );
    }

    return (
        <div className="document-details-page">

            <DocumentHeader
                document={document}
                publishing={publishing}
                downloading={downloading}
                onPublish={handlePublishClick}
                onDownload={handleDownload}
            />
            <div className="document-actions-row">

                {document.status !==
                    "DELETED" && (

                    <button
                        className="danger-button"
                        onClick={() =>
                            setShowDeleteDialog(
                                true
                            )
                        }
                    >
                        Delete
                    </button>

                )}

                {document.status ===
                    "DELETED" && (

                    <>

                        <button
                            className="primary-button"
                            onClick={() =>
                                setShowRestoreDialog(
                                    true
                                )
                            }
                        >
                            Restore
                        </button>

                        <button
                            className="danger-button"
                            onClick={() =>
                                setShowCleanupDialog(
                                    true
                                )
                            }
                        >
                            Delete Forever
                        </button>

                    </>

                )}

            </div>
            {document.status === "DRAFT" &&
                document.currentVersionId && (
                    <div className="document-status-banner info">
                        <div className="draft-actions">
                            <span>
                                Draft has an uploaded file.
                            </span>
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={handleRemoveDraftFile}
                                disabled={removingFile}
                            >
                                {removingFile
                                    ? "Removing..."
                                    : "Remove File"}
                            </button>
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                    setShowUploadSection(true);
                                    setSelectedVersionFile(null);
                                    setVersionUploadProgress(0);
                                    setActionError("");
                                }}
                                disabled={uploadingVersion}
                            >
                                Replace File
                            </button>
            </div>
            <div className="document-actions-row">
                {document.status === "DRAFT" &&
                    !document.currentVersionId && (
                        <button
                            className="secondary-button"
                            onClick={() => {
                                navigate(
                                    `/documents/${documentId}/upload`
                                );
                            }}
                        >
                            Upload File
                        </button>
                    )}
            </div>
                    </div>
                )}

            {document.status === "QUEUED" && (
                    <div className="document-status-banner info">
                        This document has been queued for processing.
                    </div>
                )}

                {document.status === "PROCESSING" && (
                    <div className="document-status-banner info">
                        Document processing is currently in progress.
                    </div>
                )}

                {document.status === "FAILED" && (
                    <div className="document-status-banner error">
                        Processing failed.
                        Please upload a new version or retry later.
                    </div>
                )}

            {actionError && (
                <div className="document-error">
                    {actionError}
                </div>
            )}

            <div className="document-card">

                <h2>
                    Document Information
                </h2>

                <div className="document-grid">

                    <div>

                        <strong>
                            Classification
                        </strong>

                        <span>
                            {document.classification}
                        </span>

                    </div>

                    <div>

                        <strong>
                            Status
                        </strong>

                        <StatusBadge
                            status={
                                document.status
                            }
                        />

                    </div>

                    <div>

                        <strong>
                            Current Version
                        </strong>

                        <span>
                            {document
                                .currentVersion
                                ?.versionNumber ??
                                "-"}
                        </span>

                    </div>

                    <div>

                        <strong>
                            Updated
                        </strong>

                        <span>
                            {new Date(
                                document.updatedAt
                            ).toLocaleString()}
                        </span>

                    </div>

                </div>

            </div>
            <div className="document-card">

            <div className="version-header">

                <h2>
                    Version History
                </h2>

                <button
                    className="primary-button"
                    disabled={
                        document.status !== "READY"
                    }
                    onClick={() =>
                        setShowUploadSection(
                            !showUploadSection
                        )
                    }
                >
                    {showUploadSection
                        ? "Cancel Upload"
                        : "Upload New Version"}
                </button>

            </div>

            {document.status === "READY" &&showUploadSection && (
                <div className="version-upload-section">

                    <UploadCard
                        selectedFile={
                            selectedVersionFile
                        }
                        uploading={
                            uploadingVersion
                        }
                        uploadProgress={
                            versionUploadProgress
                        }
                        onFileSelection={
                            handleVersionFileSelection
                        }
                        onUpload={
                            handleUploadVersion
                        }
                        onRemove={
                            handleRemoveVersionFile
                        }
                        buttonText="Upload Version"
                    />

                </div>

            )}

            {versions.length === 0 ? (

                <p>
                    No versions available.
                </p>

            ) : (

                <table className="document-version-table">

                    <thead>

                        <tr>

                            <th>
                                Version
                            </th>

                            <th>
                                File Name
                            </th>

                            <th>
                                Created
                            </th>

                            <th>
                                Actions
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        {versions.map(
                            (version) => (

                                <tr
                                    key={
                                        version.id
                                    }
                                >

                                    <td>

                                        {version.versionNumber}

                                        {document
                                            .currentVersion
                                            ?.id ===
                                            version.id && (
                                            <span className="current-version-badge">
                                                Current
                                            </span>
                                        )}

                                    </td>

                                    <td>
                                        {version.originalFileName}
                                    </td>

                                    <td>
                                        {new Date(
                                            version.createdAt
                                        ).toLocaleString()}
                                    </td>

                                    <td>

                                        <button
                                            className="secondary-button"
                                            onClick={() =>
                                                handleVersionDownload(
                                                    version.id
                                                )
                                            }
                                        >
                                            Download
                                        </button>

                                    </td>

                                </tr>

                            )
                        )}

                    </tbody>

                </table>

            )}

            </div>

            <DocumentAccess
            documentId={documentId}
            />
            <DocumentAccessHistory
                documentId={documentId}
            />
            <DeleteDocumentDialog
                open={showDeleteDialog}
                loading={deleting}
                onConfirm={handleDelete}
                onCancel={() =>
                    setShowDeleteDialog(
                        false
                    )
                }
            />

            <RestoreDocumentDialog
                open={showRestoreDialog}
                loading={deleting}
                onConfirm={handleRestore}
                onCancel={() =>
                    setShowRestoreDialog(
                        false
                    )
                }
            />

                <PublishConfirmationDialog
                open={showPublishDialog}
                document={document}
                onCancel={handleCancelPublish}
                onConfirm={handlePublish}
                loading={publishing}
            />
        </div>
    );
};

export default DocumentDetails;