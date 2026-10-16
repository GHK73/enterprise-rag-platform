import { useCallback, useEffect, useState } from "react";
import api from "@api/axios";
import ChunkRenderer from "./Query/components/ChunkRenderer";
import "./Query.css";

const HISTORY_LIMIT = 10;

const fetchQueryHistoryPage = async (offset) => {
    const response = await api.get("/query/history", {
        params: { limit: HISTORY_LIMIT, offset },
    });

    return response.data.data;
};

const Query = () => {
    const [query, setQuery] = useState("");
    const [topK, setTopK] = useState(5);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const [historyOffset, setHistoryOffset] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);

    const loadHistory = useCallback(async (offset = 0, prepend = false) => {
        try {
            setHistoryLoading(true);
            setHistoryError("");
            const data = await fetchQueryHistoryPage(offset);
            const loadedHistory = [...(data.history || [])].reverse();
            setHistoryError("");
            setHistory((currentHistory) =>
                prepend
                    ? [...loadedHistory, ...currentHistory]
                    : loadedHistory
            );
            setHistoryOffset(data.offset);
            setHasMoreHistory(data.hasMore);
        } catch (err) {
            setHistoryError(
                err?.response?.data?.message ||
                    "Failed to load query history."
            );
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const initializeHistory = async () => {
            try {
                const data = await fetchQueryHistoryPage(0);
                if (cancelled) return;

                const loadedHistory = [...(data.history || [])].reverse();
                setHistory(loadedHistory);
                setHistoryOffset(data.offset);
                setHasMoreHistory(data.hasMore);
            } catch (err) {
                if (!cancelled) {
                    setHistoryError(
                        err?.response?.data?.message ||
                            "Failed to load query history."
                    );
                }
            } finally {
                if (!cancelled) {
                    setHistoryLoading(false);
                }
            }
        };

        initializeHistory();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!query.trim()) {
            setError("Query is required.");
            return;
        }

        try {
            setLoading(true);
            setError("");
            const response = await api.post("/query", {
                query: query.trim(),
                topK,
            });
            setResult(response.data.data);
            await loadHistory();
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to execute query."
            );
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const handleHistoryClick = (item) => {
        setQuery(item.query);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const renderEvidence = (evidence) => {
        if (!evidence) return null;
        
        return (
            <div className="query-evidence">
                <h3>Evidence Assessment</h3>
                <div className="evidence-badge evidence-badge-{evidence.sufficient ? 'sufficient' : 'insufficient'}">
                    {evidence.sufficient ? "✓ Sufficient Evidence" : "✗ Insufficient Evidence"}
                </div>
                <p className="evidence-reason">{evidence.reason}</p>
                {evidence.hasStructuredEvidence && (
                    <p className="evidence-structured">Contains structured evidence (tables, formulas, or code)</p>
                )}
            </div>
        );
    };

    return (
        <div className="query-page">
            <header className="query-header">
                <h1>Ask a Question</h1>
                <p>
                    Search across your authorized documents.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="query-form">
                <textarea
                    value={query}
                    onChange={(event) =>
                        setQuery(event.target.value)
                    }
                    placeholder="Type your question..."
                    rows={3}
                />

                <div className="query-form-row">
                    <label>
                        Sources:
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={topK}
                            onChange={(event) =>
                                setTopK(Number(event.target.value))
                            }
                        />
                    </label>
                    <button
                        type="submit"
                        disabled={loading}
                        className="primary-button"
                    >
                        {loading ? "Searching..." : "Ask"}
                    </button>
                </div>
            </form>

            {error && (
                <div className="query-error">{error}</div>
            )}

            {result && (
                <div className="query-result">
                    <h2>Answer</h2>
                    <p className="query-answer">
                        {result.answer || "No answer generated."}
                    </p>

                    {renderEvidence(result.evidence)}

                    {result.sources && result.sources.length > 0 && (
                        <div className="query-sources">
                            <h3>Sources</h3>
                            <div className="sources-list">
                                {result.sources.map((source, index) => (
                                    <ChunkRenderer key={source.chunkId || index} source={source} index={index + 1} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <section className="query-history">
                <h2>Previous Queries</h2>
                {historyError && (
                    <div className="query-error" role="alert">
                        <p>{historyError}</p>
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={() => loadHistory()}
                            disabled={historyLoading}
                        >
                            Retry
                        </button>
                    </div>
                )}
                {historyLoading && history.length === 0 ? (
                    <p>Loading history...</p>
                ) : history.length === 0 ? (
                    <p>No previous conversations.</p>
                ) : (
                    <>
                        {hasMoreHistory && (
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                    loadHistory(
                                        historyOffset + HISTORY_LIMIT,
                                        true
                                    )
                                }
                                disabled={historyLoading}
                            >
                                {historyLoading
                                    ? "Loading..."
                                    : "Load Older Messages"}
                            </button>
                        )}
                        <ul className="query-history-list">
                            {history.map((item) => (
                                <li key={item.id}>
                                    <div className="query-history-turn">
                                        <button
                                            type="button"
                                            className="query-history-message query-history-question"
                                            onClick={() =>
                                                handleHistoryClick(item)
                                            }
                                        >
                                            <span className="query-history-label">
                                                You
                                            </span>
                                            {item.query}
                                        </button>
                                        <div className="query-history-message query-history-answer">
                                            <span className="query-history-label">
                                                Assistant
                                            </span>
                                            {item.answer || "No answer was saved."}
                                        </div>
                                        {item.createdAt && (
                                            <small className="query-history-timestamp">
                                                {new Date(
                                                    item.createdAt
                                                ).toLocaleString()}
                                            </small>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </section>
        </div>
    );
};

export default Query;