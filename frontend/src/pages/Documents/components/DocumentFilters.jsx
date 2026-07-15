import "./DocumentFilters.css";

const DocumentFilters = ({
    search,
    onSearchChange,
    classification,
    onClassificationChange,
    status,
    onStatusChange,
    showDeleted,
    onShowDeletedChange,
}) => {
    const handleClearFilters = () => {
        onSearchChange("");
        onClassificationChange("ALL");
        onStatusChange("ALL");
        onShowDeletedChange?.(false);
    };

    return (
        <div className="document-filters">

            <div className="document-filter-group">

                <input
                    type="text"
                    placeholder="Search documents..."
                    value={search}
                    onChange={(event) =>
                        onSearchChange(
                            event.target.value
                        )
                    }
                />

                <select
                    value={classification}
                    onChange={(event) =>
                        onClassificationChange(
                            event.target.value
                        )
                    }
                >
                    <option value="ALL">
                        All Classifications
                    </option>

                    <option value="GENERAL">
                        GENERAL
                    </option>

                    <option value="INTERNAL">
                        INTERNAL
                    </option>

                    <option value="CONFIDENTIAL">
                        CONFIDENTIAL
                    </option>

                    <option value="RESTRICTED">
                        RESTRICTED
                    </option>

                </select>

                <select
                    value={status}
                    onChange={(event) =>
                        onStatusChange(
                            event.target.value
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

            <div className="filter-actions">

                <label className="filter-checkbox">

                    <input
                        type="checkbox"
                        checked={showDeleted}
                        onChange={(event) =>
                            onShowDeletedChange?.(
                                event.target.checked
                            )
                        }
                    />

                    <span>
                        Show Deleted
                    </span>

                </label>

                <button
                    type="button"
                    className="clear-filter-button"
                    onClick={
                        handleClearFilters
                    }
                >
                    Clear Filters
                </button>

            </div>

        </div>
    );
};

export default DocumentFilters;