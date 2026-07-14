// frontend/src/pages/Organization/components/OrganizationHeader.jsx

const OrganizationHeader = ({ organization }) => {
    return (
        <header className="organization-header">
            <p className="organization-eyebrow">
                Organization Management
            </p>

            <h1>{organization.name}</h1>

            <p className="organization-description">
                {organization.description ||
                    "No description"}
            </p>
        </header>
    );
};

export default OrganizationHeader;