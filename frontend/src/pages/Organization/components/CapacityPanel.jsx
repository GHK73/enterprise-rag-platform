// frontend/src/pages/Organization/components/CapacityPanel.jsx

const CapacityPanel = ({
    selectedUnit,
    selectedUnitCapacity,

    editingCapacityId,
    allocatedCapacity,
    setAllocatedCapacity,

    updatingCapacity,

    handleEditCapacity,
    handleUpdateCapacity,
    handleCancelCapacity,
}) => {
    if (!selectedUnitCapacity) {
        return null;
    }

    return (
        <div className="organization-capacity-panel">

            <div className="organization-capacity-header">

                <h4>
                    Capacity
                </h4>

                {editingCapacityId !==
                    selectedUnit.id && (
                    <button
                        type="button"
                        onClick={() =>
                            handleEditCapacity(
                                selectedUnit
                            )
                        }
                    >
                        Set / Update
                    </button>
                )}

            </div>

            {editingCapacityId ===
            selectedUnit.id ? (
                <form
                    className="organization-capacity-form"
                    onSubmit={(e) =>
                        handleUpdateCapacity(
                            e,
                            selectedUnit.id
                        )
                    }
                >
                    <input
                        type="number"
                        min="1"
                        value={
                            allocatedCapacity
                        }
                        onChange={(e) =>
                            setAllocatedCapacity(
                                e.target.value
                            )
                        }
                        placeholder="Enter capacity"
                        required
                    />

                    <button
                        type="submit"
                        disabled={
                            updatingCapacity
                        }
                    >
                        {updatingCapacity
                            ? "Saving..."
                            : "Save"}
                    </button>

                    <button
                        type="button"
                        onClick={
                            handleCancelCapacity
                        }
                        disabled={
                            updatingCapacity
                        }
                    >
                        Cancel
                    </button>
                </form>
            ) : (
                <div className="organization-capacity-grid">

                    <div>
                        <span>
                            Allocated
                        </span>

                        <strong>
                            {
                                selectedUnitCapacity
                                    .allocatedCapacity ??
                                "Not set"
                            }
                        </strong>
                    </div>

                    <div>
                        <span>
                            Direct Members
                        </span>

                        <strong>
                            {
                                selectedUnitCapacity
                                    .directMembers
                            }
                        </strong>
                    </div>

                    <div>
                        <span>
                            Child Allocations
                        </span>

                        <strong>
                            {
                                selectedUnitCapacity
                                    .childAllocations
                            }
                        </strong>
                    </div>

                    <div>
                        <span>
                            Remaining
                        </span>

                        <strong>
                            {
                                selectedUnitCapacity
                                    .remainingCapacity ??
                                "Not set"
                            }
                        </strong>
                    </div>

                </div>
            )}

        </div>
    );
};

export default CapacityPanel;