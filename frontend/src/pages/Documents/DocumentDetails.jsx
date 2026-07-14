import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getDocumentById,
} from "../../api/document.api";
import "./DocumentDetails.css";

const DocumentDetails = () => {
    const { documentId } = useParams();

    const [document, setDocument] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const loadDocument = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await getDocumentById(
                    documentId
                );

            setDocument(response);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Failed to load document."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocument();
    }, [documentId]);

    if (loading) {
        return (
            <div className="document-details-page">
                Loading document...
            </div>
        );
    }

    if (error) {
        return (
            <div className="document-details-page">
                <div className="document-error">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="document-details-page">

            <div className="document-header">

                <div>

                    <h1>
                        {document.title}
                    </h1>

                    <p>
                        {document.description ||
                            "No description"}
                    </p>

                </div>

            </div>

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
                            {
                                document.classification
                            }
                        </span>
                    </div>

                    <div>
                        <strong>
                            Status
                        </strong>

                        <span>
                            {
                                document.lifecycle
                            }
                        </span>
                    </div>

                    <div>
                        <strong>
                            Version
                        </strong>

                        <span>
                            {
                                document.currentVersion
                                    ?.versionNumber ??
                                "-"
                            }
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

        </div>
    );
};

export default DocumentDetails;