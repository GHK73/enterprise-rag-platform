import { useCallback, useEffect, useRef, useState } from "react";
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

    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const [historyOffset, setHistoryOffset] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [activeQuery, setActiveQuery] = useState("");
    const [latestResult, setLatestResult] = useState(null);
    const historyEndRef = useRef(null);
    const queryInputRef = useRef(null);
    const shouldScrollToLatestRef = useRef(true);

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
            if (!prepend) {
                shouldScrollToLatestRef.current = true;
            }
            return data;
        } catch (err) {
            setHistoryError(
                err?.response?.data?.message ||
                    "Failed to load query history."
            );
            return null;
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!shouldScrollToLatestRef.current) return undefined;

        const frameId = window.requestAnimationFrame(() => {
            historyEndRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
            });
            shouldScrollToLatestRef.current = false;
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [history, activeQuery, historyLoading, loading]);

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
                shouldScrollToLatestRef.current = true;
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
            const submittedQuery = query.trim();
            setActiveQuery(submittedQuery);
            setLatestResult(null);
            const response = await api.post("/query", {
                query: submittedQuery,
                topK,
            });
            const historyData = await loadHistory();
            const latestHistoryItem = historyData?.history?.[0];
            setLatestResult(
                latestHistoryItem
                    ? {
                          historyId: latestHistoryItem.id,
                          data: response.data.data,
                      }
                    : null
            );
            setActiveQuery("");
            setQuery("");
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                    "Failed to execute query."
            );
            setActiveQuery("");
        } finally {
            setLoading(false);
        }
    };

    const handleHistoryClick = (item) => {
        setQuery(item.query);
        queryInputRef.current?.focus();
    };

    const renderEvidence = (evidence) => {
        if (!evidence) return null;
        
        return (
            <div className="query-evidence">
                <h3>Evidence Assessment</h3>
                <div className={`evidence-badge evidence-badge-${evidence.sufficient ? "sufficient" : "insufficient"}`}>
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

            <section className="query-history">
                <div className="query-history-header">
                    <h2>Conversation</h2>
                    {history.length > 0 && (
                        <span>Latest messages appear at the bottom</span>
                    )}
                </div>
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
                <div className="query-history-scroll">
                    {historyLoading && history.length === 0 ? (
                        <p className="query-history-state">Loading conversation...</p>
                    ) : history.length === 0 && !activeQuery ? (
                        <p className="query-history-state">
                            No previous conversations. Ask a question to get started.
                        </p>
                    ) : null}
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
                    {(history.length > 0 || activeQuery) && (
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
                                            {latestResult?.historyId === item.id && (
                                                <div className="query-result-details">
                                                    {renderEvidence(latestResult.data.evidence)}
                                                    {latestResult.data.sources?.length > 0 && (
                                                        <div className="query-sources">
                                                            <h3>Sources</h3>
                                                            <div className="sources-list">
                                                                {latestResult.data.sources.map((source, index) => (
                                                                    <ChunkRenderer
                                                                        key={source.chunkId || index}
                                                                        source={source}
                                                                        index={index + 1}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                            {activeQuery && (
                                <li className="query-history-turn">
                                    <div className="query-history-message query-history-question">
                                        <span className="query-history-label">You</span>
                                        {activeQuery}
                                    </div>
                                    <div className="query-history-message query-history-answer query-thinking" role="status">
                                        <span className="query-history-label">Assistant</span>
                                        Thinking...
                                    </div>
                                </li>
                            )}
                        </ul>
                    )}
                    <div ref={historyEndRef} />
                </div>
            </section>

            {error && (
                <div className="query-error" role="alert">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="query-form">
                <textarea
                    ref={queryInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ask a question..."
                    rows={2}
                    aria-label="Ask a question"
                />

                <div className="query-form-row">
                    <label>
                        Sources:
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={topK}
                            onChange={(event) => setTopK(Number(event.target.value))}
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
        </div>
    );
};

export default Query;