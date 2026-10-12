import {
    useEffect,
    useMemo,
    useState,
    useCallback,
} from "react";

import { Link } from "react-router-dom";

import { getDocuments, reprocessDocument } from "../../api/document.api";

import DocumentFilters from "./components/DocumentFilters";
import StatusBadge from "./components/StatusBadge";

import "./DocumentProcessingQueue.css";

const PROCESSING_STATUSES = ["QUEUED", "PROCESSING", "FAILED"];

const DocumentProcessingQueue = () => {
    const [documents, setDocuments] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [search, setSearch] = useState("");

    const [lifecycle, setLifecycle] = useState("ALL");

    const [autoRefresh, setAutoRefresh] = useState(true);

    const [reprocessing, setReprocessing] = useState(null);

    const loadDocuments = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getDocuments(false);

            const processingDocs = (response || []).filter((doc) =>
                PROCESSING_STATUSES.includes(doc.status)
            );

            setDocuments(processingDocs);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to load processing queue."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const handleReprocess = async (document) => {
        if (!document.currentVersionId) return;

        try {
            setReprocessing(document.id);
            setError("");

            await reprocessDocument(document.id, document.currentVersionId);

            await loadDocuments();
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to queue reprocessing."
            );
        } finally {
            setReprocessing(null);
        }
    };

    useEffect(() => {
        async function initialize() {
            await loadDocuments();
        }
        initialize();
    }, [loadDocuments]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(async () => {
            await loadDocuments();
        }, 5000);

        return () => clearInterval(interval);
    }, [autoRefresh, loadDocuments]);

    const filteredDocuments = useMemo(() => {
        return documents.filter((document) => {
            const matchesSearch =
                !search ||
                document.title
                    ?.toLowerCase()
                    .includes(search.toLowerCase()) ||
                document.description
                    ?.toLowerCase()
                    .includes(search.toLowerCase());

            const matchesLifecycle =
                lifecycle === "ALL" || document.status === lifecycle;

            return matchesSearch && matchesLifecycle;
        });
    }, [documents, search, lifecycle]);

    const statusCounts = useMemo(() => {
        return documents.reduce(
            (acc, doc) => {
                acc[doc.status] = (acc[doc.status] || 0) + 1;
                return acc;
            },
            { QUEUED: 0, PROCESSING: 0, FAILED: 0 }
        );
    }, [documents]);

    if (loading) {
        return (
            <div className="processing-queue-page">
                <div className="processing-queue-header">
                    <h1>Processing Queue</h1>
                </div>
                <div className="processing-queue-loading">
                    Loading processing queue...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="processing-queue-page">
                <div className="processing-queue-header">
                    <h1>Processing Queue</h1>
                </div>
                <div className="processing-queue-error">
                    <p>{error}</p>
                    <button className="primary-button" onClick={loadDocuments}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="processing-queue-page">
            <div className="processing-queue-header">
                <div>
                    <h1>Processing Queue</h1>
                    <p>
                        Monitor document processing status and retry failed documents.
                    </p>
                </div>
                <div className="processing-queue-actions">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh (5s)
                    </label>
                    <button className="secondary-button" onClick={loadDocuments}>
                        Refresh Now
                    </button>
                </div>
            </div>

            <div className="processing-status-summary">
                <div className="status-card queued">
                    <span className="status-count">{statusCounts.QUEUED}</span>
                    <span className="status-label">Queued</span>
                </div>
                <div className="status-card processing">
                    <span className="status-count">{statusCounts.PROCESSING}</span>
                    <span className="status-label">Processing</span>
                </div>
                <div className="status-card failed">
                    <span className="status-count">{statusCounts.FAILED}</span>
                    <span className="status-label">Failed</span>
                </div>
            </div>

            <DocumentFilters
                search={search}
                onSearchChange={setSearch}
                classification="ALL"
                onClassificationChange={() => {}}
                lifecycle={lifecycle}
                onLifecycleChange={setLifecycle}
                showDeleted={false}
                onShowDeletedChange={() => {}}
            />

            {filteredDocuments.length === 0 ? (
                <div className="processing-queue-empty">
                    <h2>No Processing Documents</h2>
                    <p>No documents match the current filters.</p>
                </div>
            ) : (
                <div className="processing-queue-table-container">
                    <table className="processing-queue-table">
                        <thead>
                            <tr>
                                <th>Document</th>
                                <th>Version</th>
                                <th>Status</th>
                                <th>Processing Status</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDocuments.map((document) => (
                                <tr key={document.id}>
                                    <td>
                                        <Link to={`/documents/${document.id}`}>
                                            {document.title}
                                        </Link>
                                    </td>
                                    <td>
                                        {document.currentVersion?.versionNumber ?? "-"}
                                    </td>
                                    <td>
                                        <StatusBadge status={document.status} />
                                    </td>
                                    <td>
                                        <StatusBadge
                                            status={
                                                document.currentVersion?.processingStatus ||
                                                document.status
                                            }
                                        />
                                    </td>
                                    <td>
                                        {new Date(document.updatedAt).toLocaleString()}
                                    </td>
                                    <td>
                                        {document.status === "FAILED" && (
                                            <button
                                                className="reprocess-button"
                                                onClick={() =>
                                                    handleReprocess(document)
                                                }
                                                disabled={reprocessing === document.id}
                                            >
                                                {reprocessing === document.id
                                                    ? "Queuing..."
                                                    : "Reprocess"}
                                            </button>
                                        )}
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

export default DocumentProcessingQueue;