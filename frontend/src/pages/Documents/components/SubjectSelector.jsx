const SubjectSelector = ({
    value,
    onChange,
}) => {
    return (
        <div className="form-group">

            <label>
                Subject Type
            </label>

            <select
                value={value}
                onChange={(event) =>
                    onChange(
                        event.target.value
                    )
                }
            >

                <option value="ORGANIZATION">
                    Organization
                </option>

                <option value="UNIT">
                    Unit
                </option>

                <option value="ROLE">
                    Role
                </option>

                <option value="USER">
                    User
                </option>

            </select>

        </div>
    );
};

export default SubjectSelector;