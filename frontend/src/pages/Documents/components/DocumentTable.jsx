import { Link } from "react-router-dom";

import StatusBadge from "./StatusBadge";

const DocumentTable = ({ documents }) => {
    const formatDate = (date) => {
        if (!date) {
            return "-";
        }

        return new Date(date).toLocaleDateString();
    };

    const isExpiredDraft = (document) => {
        if (
            document.status !== "DRAFT" ||
            !document.draftExpiresAt
        ) {
            return false;
        }

        return (
            new Date(document.draftExpiresAt) <
            new Date()
        );
    };

    return (
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

                    {documents.map((document) => {

                        const expired =
                            isExpiredDraft(
                                document
                            );

                        return (
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

                                        {expired && (
                                            <small className="document-expired">
                                                Draft
                                                Expired
                                            </small>
                                        )}

                                        {document.status ===
                                            "DELETED" && (
                                            <small className="document-deleted">
                                                Deleted
                                            </small>
                                        )}

                                    </div>

                                </td>

                                <td>
                                    {document.classification ||
                                        "-"}
                                </td>

                                <td>

                                    <StatusBadge
                                        status={
                                            document.status
                                        }
                                    />

                                </td>

                                <td>

                                    {document
                                        .currentVersion
                                        ?.versionNumber ??
                                        "-"}

                                </td>

                                <td>

                                    {formatDate(
                                        document.updatedAt
                                    )}

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
                        );
                    })}

                </tbody>

            </table>

        </div>
    );
};

export default DocumentTable;