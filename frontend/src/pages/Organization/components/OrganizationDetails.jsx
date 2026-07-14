// frontend/src/pages/Organization/components/OrganizationDetails.jsx

const OrganizationDetails = ({
    selectedUnit,
    selectedUnitMembers,
    unitsByParent,

    editingUnitId,
    editingName,
    setEditingName,

    movingUnitId,
    destinationParentId,
    setDestinationParentId,

    validDestinationUnits,

    updating,
    movingUnit,
    deletingUnitId,
    loadingCapacityId,

    handleUpdateUnit,
    handleCancelEdit,

    handleUpdateUnitParent,
    handleCancelMoveUnit,

    handleViewCapacity,
    handleEditUnit,
    handleMoveUnit,
    handleDeleteUnit,

    children,
}) => {
    if (!selectedUnit) {
        return (
            <div className="organization-empty-panel">
                <h3>Select a unit</h3>

                <p>
                    Choose a unit from the hierarchy
                    to manage it.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="organization-selected-header">
                <div className="organization-selected-icon">
                    {selectedUnit.name
                        .charAt(0)
                        .toUpperCase()}
                </div>

                <div>
                    <span>
                        {selectedUnit.type}
                    </span>

                    <h3>
                        {selectedUnit.name}
                    </h3>

                    <p>
                        {selectedUnitMembers.length}
                        {" "}
                        direct members
                    </p>
                </div>
            </div>

            {editingUnitId ===
            selectedUnit.id ? (
                <form
                    className="organization-unit-edit-form"
                    onSubmit={(e) =>
                        handleUpdateUnit(
                            e,
                            selectedUnit.id
                        )
                    }
                >
                    <input
                        type="text"
                        value={editingName}
                        onChange={(e) =>
                            setEditingName(
                                e.target.value
                            )
                        }
                        required
                        autoFocus
                    />

                    <button
                        type="submit"
                        disabled={updating}
                    >
                        {updating
                            ? "Saving..."
                            : "Save"}
                    </button>

                    <button
                        type="button"
                        onClick={
                            handleCancelEdit
                        }
                        disabled={updating}
                    >
                        Cancel
                    </button>
                </form>
            ) : movingUnitId ===
            selectedUnit.id ? (
                <form
                    className="organization-unit-move-form"
                    onSubmit={(e) =>
                        handleUpdateUnitParent(
                            e,
                            selectedUnit.id
                        )
                    }
                >
                    <select
                        value={
                            destinationParentId
                        }
                        onChange={(e) =>
                            setDestinationParentId(
                                e.target.value
                            )
                        }
                        required
                    >
                        <option value="">
                            Select new parent
                        </option>

                        {validDestinationUnits.map(
                            (
                                destinationUnit
                            ) => (
                                <option
                                    key={
                                        destinationUnit.id
                                    }
                                    value={
                                        destinationUnit.id
                                    }
                                >
                                    {
                                        destinationUnit.name
                                    }
                                    {" "}
                                    (
                                    {
                                        destinationUnit.type
                                    }
                                    )
                                </option>
                            )
                        )}
                    </select>

                    <button
                        type="submit"
                        disabled={movingUnit}
                    >
                        {movingUnit
                            ? "Moving..."
                            : "Move"}
                    </button>

                    <button
                        type="button"
                        onClick={
                            handleCancelMoveUnit
                        }
                        disabled={movingUnit}
                    >
                        Cancel
                    </button>
                </form>
            ) : (
                <div className="organization-selected-actions">
                    <button
                        type="button"
                        onClick={() =>
                            handleViewCapacity(
                                selectedUnit.id
                            )
                        }
                        disabled={
                            loadingCapacityId ===
                            selectedUnit.id
                        }
                    >
                        {loadingCapacityId ===
                        selectedUnit.id
                            ? "Loading..."
                            : "Capacity"}
                    </button>

                    {selectedUnit.type !==
                        "COMPANY" && (
                        <>
                            <button
                                type="button"
                                onClick={() =>
                                    handleEditUnit(
                                        selectedUnit
                                    )
                                }
                            >
                                Rename
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    handleMoveUnit(
                                        selectedUnit
                                    )
                                }
                            >
                                Move
                            </button>

                            <button
                                className="organization-danger-button"
                                type="button"
                                onClick={() =>
                                    handleDeleteUnit(
                                        selectedUnit
                                    )
                                }
                                disabled={
                                    deletingUnitId ===
                                    selectedUnit.id
                                }
                            >
                                {deletingUnitId ===
                                selectedUnit.id
                                    ? "Deleting..."
                                    : "Delete"}
                            </button>
                        </>
                    )}
                </div>
            )}

            {children}

            <div className="organization-unit-summary">
                <div>
                    <span>
                        Child Units
                    </span>

                    <strong>
                        {
                            (
                                unitsByParent[
                                    selectedUnit.id
                                ] || []
                            ).length
                        }
                    </strong>
                </div>

                <div>
                    <span>
                        Direct Members
                    </span>

                    <strong>
                        {
                            selectedUnitMembers.length
                        }
                    </strong>
                </div>
            </div>
        </>
    );
};

export default OrganizationDetails;