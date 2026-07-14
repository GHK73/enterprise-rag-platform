import {
    useEffect,
    useMemo,
    useState,
} from "react";

import { Link } from "react-router-dom";

import { getDocuments } from "../../api/document.api";

import DocumentFilters from "./components/DocumentFilters";
import DocumentTable from "./components/DocumentTable";

import "./DocumentLibrary.css";

const DocumentLibrary = () => {
    const [documents, setDocuments] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [
        classification,
        setClassification,
    ] = useState("ALL");

    const [
        lifecycle,
        setLifecycle,
    ] = useState("ALL");

    const loadDocuments = async () => {
        try {
            setLoading(true);

            setError("");

            const response =
                await getDocuments();

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

    const filteredDocuments = useMemo(() => {
        return documents.filter(
            (document) => {
                const matchesSearch =
                    !search ||
                    document.title
                        ?.toLowerCase()
                        .includes(
                            search.toLowerCase()
                        ) ||
                    document.description
                        ?.toLowerCase()
                        .includes(
                            search.toLowerCase()
                        );

                const matchesClassification =
                    classification ===
                        "ALL" ||
                    document.classification ===
                        classification;

                const matchesLifecycle =
                    lifecycle === "ALL" ||
                    document.lifecycle ===
                        lifecycle;

                return (
                    matchesSearch &&
                    matchesClassification &&
                    matchesLifecycle
                );
            }
        );
    }, [
        documents,
        search,
        classification,
        lifecycle,
    ]);

    if (loading) {
        return (
            <div className="document-library-page">

                <div className="document-library-header">

                    <h1>
                        Document Library
                    </h1>

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

                    <h1>
                        Document Library
                    </h1>

                </div>

                <div className="document-library-error">

                    <p>{error}</p>

                    <button
                        className="primary-button"
                        onClick={
                            loadDocuments
                        }
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

                    <h1>
                        Document Library
                    </h1>

                    <p>
                        Manage enterprise
                        documents, drafts,
                        and published
                        knowledge.
                    </p>

                </div>

                <Link
                    to="/documents/new"
                    className="primary-button"
                >
                    + New Document
                </Link>

            </div>

            <DocumentFilters
                search={search}
                onSearchChange={
                    setSearch
                }
                classification={
                    classification
                }
                onClassificationChange={
                    setClassification
                }
                lifecycle={lifecycle}
                onLifecycleChange={
                    setLifecycle
                }
            />

            {filteredDocuments.length ===
            0 ? (
                <div className="document-library-empty">

                    <h2>
                        No Documents Found
                    </h2>

                    <p>
                        No documents match
                        the current
                        filters.
                    </p>

                </div>
            ) : (
                <DocumentTable
                    documents={
                        filteredDocuments
                    }
                />
            )}

        </div>
    );
};

export default DocumentLibrary;