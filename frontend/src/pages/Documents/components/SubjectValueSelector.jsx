const SubjectValueSelector = ({
    subjectType,
    organization,
    units,
    members,
    value,
    onChange,
    scope,
    onScopeChange,
}) => {
    const handleChange = (event) => {
        onChange(event.target.value);
    };

    if (subjectType === "ORGANIZATION") {
        return (
            <div className="form-group">

                <label>
                    Organization
                </label>

                <input
                    type="text"
                    value={
                        organization?.name ||
                        "Current Organization"
                    }
                    disabled
                />

                <small className="form-helper">
                    This policy applies to every member of the organization.
                </small>

            </div>
        );
    }

    if (subjectType === "ROLE") {
        return (
            <div className="form-group">

                <label>
                    Role
                </label>

                <select
                    value={value}
                    onChange={handleChange}
                >
                    <option value="">
                        Select Role
                    </option>

                    <option value="OWNER">
                        OWNER
                    </option>

                    <option value="ADMIN">
                        ADMIN
                    </option>

                    <option value="MANAGER">
                        MANAGER
                    </option>

                    <option value="MEMBER">
                        MEMBER
                    </option>
                </select>

            </div>
        );
    }

    if (subjectType === "UNIT") {
        return (
            <>
                <div className="form-group">

                    <label>
                        Organization Unit
                    </label>

                    <select
                        value={value}
                        onChange={handleChange}
                    >
                        <option value="">
                            Select Unit
                        </option>

                        {units.length === 0 ? (
                            <option disabled>
                                No units available
                            </option>
                        ) : (
                            units.map((unit) => (
                                <option
                                    key={unit.id}
                                    value={unit.id}
                                >
                                    {unit.name}
                                </option>
                            ))
                        )}

                    </select>

                </div>

                <div className="form-group">

                    <label>
                        Unit Scope
                    </label>

                    <select
                        value={scope}
                        onChange={(event) =>
                            onScopeChange(
                                event.target.value
                            )
                        }
                    >
                        <option value="UNIT_ONLY">
                            Unit Only
                        </option>

                        <option value="UNIT_AND_DESCENDANTS">
                            Unit and Descendants
                        </option>
                    </select>

                    <small className="form-helper">
                        Choose whether access applies only to this unit or also to its child units.
                    </small>

                </div>
            </>
        );
    }

    return (
        <div className="form-group">

            <label>
                Member
            </label>

            <select
                value={value}
                onChange={handleChange}
            >
                <option value="">
                    Select Member
                </option>

                {members.length === 0 ? (
                    <option disabled>
                        No members available
                    </option>
                ) : (
                    members.map((member) => (
                        <option
                            key={member.id}
                            value={member.id}
                        >
                            {member.fullName ||
                                member.name ||
                                member.email}
                        </option>
                    ))
                )}

            </select>

        </div>
    );
};

export default SubjectValueSelector;