const AccessHistoryRow = ({
    entry,
}) => {
    const actor =
        entry.actorName ||
        entry.actor?.name ||
        "System";

    const subject =
        entry.subjectName ||
        entry.subjectUser?.name ||
        entry.subjectUnit?.name ||
        entry.subjectRole ||
        "Unknown";

    const reason =
        entry.reason ||
        "-";

    const formatState = (state) => {
        if (!state) {
            return "";
        }

        if (typeof state === "object") {
            return Object.entries(state)
                .map(
                    ([key, value]) =>
                        `${key}: ${value}`
                )
                .join(", ");
        }

        return String(state);
    };

    const previousState = formatState(
        entry.previousState
    );
    const newState = formatState(entry.newState);

    return (
        <tr>

            <td>

                <span className="history-event">

                    {entry.eventType}

                </span>

            </td>

            <td>

                {subject}

            </td>

            <td>

                {actor}

            </td>

            <td>

                {entry.createdAt
                    ? new Date(
                          entry.createdAt
                      ).toLocaleString()
                    : "-"}

            </td>

            <td>

                {reason}

            </td>

            <td className="history-state">

                {previousState && (
                    <small>
                        <strong>Previous:</strong>{" "}
                        {previousState}
                    </small>
                )}

                {newState && (
                    <small>
                        <strong>New:</strong> {newState}
                    </small>
                )}

            </td>

        </tr>
    );
};

export default AccessHistoryRow;