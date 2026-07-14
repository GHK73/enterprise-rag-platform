// frontend/src/pages/Organization/components/UpdateNotification.jsx

const UpdateNotification = ({
    hasOrganizationUpdates,

    organizationRevision,
    latestOrganizationRevision,

    refreshingOrganization,

    handleRefreshOrganizationChanges,
}) => {

    if (
        !hasOrganizationUpdates
    ) {
        return null;
    }


    return (
        <div className="organization-updates-available">

            <div>

                <strong>
                    Organization updates available
                </strong>


                <p>
                    Another user has changed the
                    organization since this page
                    was loaded.
                </p>

            </div>


            <div className="organization-updates-actions">

                <span>
                    Revision{" "}
                    {organizationRevision}

                    {" → "}

                    {latestOrganizationRevision}
                </span>


                <button
                    type="button"
                    onClick={
                        handleRefreshOrganizationChanges
                    }
                    disabled={
                        refreshingOrganization
                    }
                >

                    {
                        refreshingOrganization
                            ? "Refreshing..."
                            : "Refresh Changes"
                    }

                </button>

            </div>

        </div>
    );
};

export default UpdateNotification;