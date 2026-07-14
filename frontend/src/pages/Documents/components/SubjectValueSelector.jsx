const SubjectValueSelector = ({
    subjectType,
    units,
    members,
    value,
    onChange,
}) => {

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
                    onChange={(event) =>
                        onChange(
                            event.target.value
                        )
                    }
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
                    Unit
                </label>

                <select
                    value={value}
                    onChange={(event) =>
                        onChange(
                            event.target.value
                        )
                    }
                >

                    <option value="">
                        Select Unit
                    </option>

                    {units.map((unit) => (
                        <option
                            key={unit.id}
                            value={unit.id}
                        >
                            {unit.name}
                        </option>
                    ))}

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
                onChange={(event) =>
                    onChange(
                        event.target.value
                    )
                }
            >

                <option value="">
                    Select Member
                </option>

                {members.map((member) => (
                    <option
                        key={member.id}
                        value={member.id}
                    >
                        {member.name}
                    </option>
                ))}

            </select>

        </div>
    );
};

export default SubjectValueSelector;