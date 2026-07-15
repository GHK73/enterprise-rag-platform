const SubjectValueSelector = ({
    subjectType,
    units,
    members,
    value,
    onChange,
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
                    value="Current Organization"
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
                            {member.name}
                        </option>
                    ))
                )}

            </select>

        </div>
    );
};

export default SubjectValueSelector;