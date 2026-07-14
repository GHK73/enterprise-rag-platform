import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

const DocumentTable = ({ documents }) => {
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
                                            {document.description}
                                        </span>
                                    )}
                                </div>
                            </td>

                            <td>
                                {document.classification || "-"}
                            </td>

                            <td>
                                <StatusBadge
                                    status={
                                        document.lifecycle
                                    }
                                />
                            </td>

                            <td>
                                {document.currentVersion
                                    ?.versionNumber ?? "-"}
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
    );
};

export default DocumentTable;