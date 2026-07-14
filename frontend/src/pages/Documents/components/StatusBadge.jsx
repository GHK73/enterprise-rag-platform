const getStatusClass = (status) => {
    switch (status) {
        case "READY":
            return "status-ready";

        case "PROCESSING":
            return "status-processing";

        case "QUEUED":
            return "status-queued";

        case "SUBMITTED":
            return "status-submitted";

        case "FAILED":
            return "status-failed";

        case "DRAFT":
            return "status-draft";

        case "EXPIRED":
            return "status-expired";

        case "DELETED":
            return "status-deleted";

        default:
            return "";
    }
};

const StatusBadge = ({ status }) => {
    return (
        <span
            className={`status-badge ${getStatusClass(status)}`}
        >
            {status}
        </span>
    );
};

export default StatusBadge;