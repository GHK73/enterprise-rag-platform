const AccessHistoryRow = ({
    entry,
}) => {
    const actor =
        entry.actor?.name ||
        entry.actorName ||
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

        </tr>
    );
};

export default AccessHistoryRow;