// frontend/src/pages/Documents/DocumentLibrary.jsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDocuments } from "../../api/document.api";
import "./DocumentLibrary.css";

const DocumentLibrary = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDocuments = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getDocuments();

            setDocuments(response || []);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to load documents."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const getStatusClass = (status) => {
        switch (status) {
            case "READY":
                return "status-ready";

            case "PROCESSING":
                return "status-processing";

            case "QUEUED":
                return "status-queued";

            case "SUBMITTED":
                return "status-submitted";

            case "FAILED":
                return "status-failed";

            case "DRAFT":
                return "status-draft";

            case "EXPIRED":
                return "status-expired";

            case "DELETED":
                return "status-deleted";

            default:
                return "";
        }
    };

    if (loading) {
        return (
            <div className="document-library-page">
                <div className="document-library-header">
                    <h1>Document Library</h1>
                </div>

                <div className="document-library-loading">
                    Loading documents...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="document-library-page">
                <div className="document-library-header">
                    <h1>Document Library</h1>
                </div>

                <div className="document-library-error">
                    <p>{error}</p>

                    <button
                        onClick={loadDocuments}
                        className="primary-button"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="document-library-page">
            <div className="document-library-header">
                <div>
                    <h1>Document Library</h1>

                    <p>
                        Manage enterprise documents,
                        drafts, and published knowledge.
                    </p>
                </div>

                <Link
                    to="/documents/new"
                    className="primary-button"
                >
                    + New Document
                </Link>
            </div>

            {documents.length === 0 ? (
                <div className="document-library-empty">
                    <h2>No Documents Found</h2>

                    <p>
                        Create your first document draft to
                        start building your organization
                        knowledge base.
                    </p>

                    <Link
                        to="/documents/new"
                        className="primary-button"
                    >
                        Create Document
                    </Link>
                </div>
            ) : (
                <div className="document-table-wrapper">
                    <table className="document-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Classification</th>
                                <th>Status</th>
                                <th>Version</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {documents.map((document) => (
                                <tr key={document.id}>
                                    <td>
                                        <div className="document-name">
                                            <strong>
                                                {document.title ||
                                                    "Untitled Document"}
                                            </strong>

                                            {document.description && (
                                                <span>
                                                    {
                                                        document.description
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td>
                                        {document.classification ||
                                            "-"}
                                    </td>

                                    <td>
                                        <span
                                            className={`status-badge ${getStatusClass(
                                                document.lifecycle
                                            )}`}
                                        >
                                            {
                                                document.lifecycle
                                            }
                                        </span>
                                    </td>

                                    <td>
                                        {document.currentVersion
                                            ?.versionNumber ??
                                            "-"}
                                    </td>

                                    <td>
                                        {document.updatedAt
                                            ? new Date(
                                                  document.updatedAt
                                              ).toLocaleDateString()
                                            : "-"}
                                    </td>

                                    <td>
                                        <Link
                                            to={`/documents/${document.id}`}
                                            className="table-action-button"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DocumentLibrary;