import "./DocumentFilters.css";

const DocumentFilters = ({
    search,
    onSearchChange,
    classification,
    onClassificationChange,
    lifecycle,
    onLifecycleChange,
}) => {
    return (
        <div className="document-filters">
            <input
                type="text"
                placeholder="Search documents..."
                value={search}
                onChange={(e) =>
                    onSearchChange(e.target.value)
                }
            />

            <select
                value={classification}
                onChange={(e) =>
                    onClassificationChange(
                        e.target.value
                    )
                }
            >
                <option value="ALL">
                    All Classifications
                </option>

                <option value="GENERAL">
                    GENERAL
                </option>

                <option value="CONFIDENTIAL">
                    CONFIDENTIAL
                </option>

                <option value="SECRET">
                    SECRET
                </option>
            </select>

            <select
                value={lifecycle}
                onChange={(e) =>
                    onLifecycleChange(
                        e.target.value
                    )
                }
            >
                <option value="ALL">
                    All Status
                </option>

                <option value="DRAFT">
                    Draft
                </option>

                <option value="SUBMITTED">
                    Submitted
                </option>

                <option value="QUEUED">
                    Queued
                </option>

                <option value="PROCESSING">
                    Processing
                </option>

                <option value="READY">
                    Ready
                </option>

                <option value="FAILED">
                    Failed
                </option>

                <option value="EXPIRED">
                    Expired
                </option>

                <option value="DELETED">
                    Deleted
                </option>
            </select>
        </div>
    );
};

export default DocumentFilters;