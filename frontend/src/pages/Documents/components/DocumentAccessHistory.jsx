import {
    useEffect,
    useState,
} from "react";

import { getDocumentAccessHistory } from "../../../api/document.api";

import AccessHistoryTable from "./AccessHistoryTable";

const DocumentAccessHistory = ({
    documentId,
}) => {
    const [history, setHistory] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const loadHistory = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await getDocumentAccessHistory(
                    documentId
                );

            setHistory(response || []);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to load access history."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [documentId]);

    if (loading) {
        return (
            <div className="document-card">

                <h2>
                    Access History
                </h2>

                <p>
                    Loading history...
                </p>

            </div>
        );
    }

    return (
        <div className="document-card">

            <h2>
                Access History
            </h2>

            {error && (
                <div className="document-error">
                    {error}
                </div>
            )}

            <AccessHistoryTable
                history={history}
            />

        </div>
    );
};

export default DocumentAccessHistory;