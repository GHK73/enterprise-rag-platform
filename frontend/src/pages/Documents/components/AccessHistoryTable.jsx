import AccessHistoryRow from "./AccessHistoryRow";

const AccessHistoryTable = ({
    history,
}) => {
    if (!history.length) {
        return (
            <p>
                No audit history found.
            </p>
        );
    }

    return (
        <div className="document-table-wrapper">

            <table className="document-version-table">

                <thead>

                    <tr>

                        <th>
                            Event
                        </th>

                        <th>
                            Subject
                        </th>

                        <th>
                            Actor
                        </th>

                        <th>
                            Date
                        </th>

                        <th>
                            Reason
                        </th>

                    </tr>

                </thead>

                <tbody>

                    {history.map(
                        (entry) => (
                            <AccessHistoryRow
                                key={entry.id}
                                entry={entry}
                            />
                        )
                    )}

                </tbody>

            </table>

        </div>
    );
};

export default AccessHistoryTable;