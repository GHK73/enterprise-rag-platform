import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
    getDocumentById,
    publishDocumentDraft,
    downloadDocument,
    getDocumentVersions,
    uploadDocumentVersion,
} from "../../api/document.api";

import DocumentHeader from "./components/DocumentHeader";
import StatusBadge from "./components/StatusBadge";
import UploadCard from "./components/UploadCard";
import DocumentAccess from "./components/DocumentAccess.jsx";

import "./DocumentDetails.css";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const DocumentDetails = () => {
    const { documentId } = useParams();

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

    const [actionError, setActionError] =
        useState("");

    const loadDocument = async () => {
        try {
            setLoading(true);

            setPageError("");

            const response =
                await getDocumentById(
                    documentId
                );

            setDocument(response);
        } catch (err) {
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
        } catch (err) {
            setActionError(
                err?.response?.data?.message ||
                    "Failed to publish document."
            );
        } finally {
            setPublishing(false);
        }
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

    const handleVersionDownload = async (
        versionId
    ) => {
        try {
            setActionError("");

            const response =
                await downloadDocument(
                    documentId,
                    versionId
                );

            window.open(
                response.downloadUrl,
                "_blank"
            );
        } catch (err) {
            setActionError(
                err?.response?.data?.message ||
                    "Failed to download version."
            );
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
    }, [documentId]);
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
                onPublish={handlePublish}
                onDownload={handleDownload}
            />

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
                                document.lifecycle
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

            {showUploadSection && (

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

        </div>
    );
};

export default DocumentDetails;