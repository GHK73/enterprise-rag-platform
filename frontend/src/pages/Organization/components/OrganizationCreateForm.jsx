// frontend/src/pages/Organization/components/OrganizationCreateForm.jsx

const OrganizationCreateForm = ({
    handleCreateUnit,
    parentId,
    setParentId,
    availableParentUnits,
    childType,
    name,
    setName,
    creating,
}) => {
    return (
        <form
            className="organization-create-form"
            onSubmit={handleCreateUnit}
        >
            <div className="organization-form-field">
                <label htmlFor="parent-unit">
                    Parent Unit
                </label>

                <select
                    id="parent-unit"
                    value={parentId}
                    onChange={(e) =>
                        setParentId(e.target.value)
                    }
                    required
                >
                    <option value="">
                        Select parent unit
                    </option>

                    {availableParentUnits.map(
                        (unit) => (
                            <option
                                key={unit.id}
                                value={unit.id}
                            >
                                {unit.name}
                                {" "}
                                ({unit.type})
                            </option>
                        )
                    )}
                </select>
            </div>

            <div className="organization-form-field">
                <label htmlFor="unit-name">
                    {childType
                        ? `Create ${childType}`
                        : "Organization Unit"}
                </label>

                <input
                    id="unit-name"
                    type="text"
                    placeholder="Enter unit name"
                    value={name}
                    onChange={(e) =>
                        setName(e.target.value)
                    }
                    required
                />
            </div>

            <button
                className="organization-create-button"
                type="submit"
                disabled={
                    creating || !childType
                }
            >
                {creating
                    ? "Creating..."
                    : childType
                        ? `Add ${childType}`
                        : "Select Parent"}
            </button>
        </form>
    );
};

export default OrganizationCreateForm;