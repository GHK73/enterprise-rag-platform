const OrganizationTreeNode = ({
    unit,
    depth,

    unitsByParent,

    expandedUnitIds,
    selectedUnitId,

    handleToggleUnit,
    handleSelectUnit,
}) => {
    const childUnits =
        unitsByParent[unit.id] || [];

    const hasChildren =
        childUnits.length > 0;

    const isExpanded =
        expandedUnitIds.includes(unit.id);

    const isSelected =
        selectedUnitId === unit.id;

    return (
        <div className="organization-tree-branch">

            <div
                className={
                    `organization-tree-row ${
                        isSelected
                            ? "organization-tree-row-selected"
                            : ""
                    }`
                }
                style={{
                    "--organization-tree-depth":
                        depth,
                }}
            >

                <button
                    className="organization-tree-toggle"
                    type="button"
                    onClick={() =>
                        hasChildren &&
                        handleToggleUnit(unit.id)
                    }
                    disabled={!hasChildren}
                    aria-label={
                        isExpanded
                            ? "Collapse unit"
                            : "Expand unit"
                    }
                >
                    {hasChildren
                        ? isExpanded
                            ? "−"
                            : "+"
                        : "·"}
                </button>

                <button
                    className="organization-tree-select"
                    type="button"
                    onClick={() =>
                        handleSelectUnit(unit)
                    }
                >

                    <span className="organization-tree-icon">
                        {unit.name
                            .charAt(0)
                            .toUpperCase()}
                    </span>

                    <span className="organization-tree-content">

                        <strong>
                            {unit.name}
                        </strong>

                        <small>
                            {unit.type}
                        </small>

                    </span>

                </button>

                <span className="organization-tree-count">
                    {childUnits.length}
                </span>

            </div>

            {hasChildren &&
                isExpanded && (
                    <div className="organization-tree-children">

                        {childUnits.map(
                            (childUnit) => (
                                <OrganizationTreeNode
                                    key={
                                        childUnit.id
                                    }
                                    unit={
                                        childUnit
                                    }
                                    depth={
                                        depth + 1
                                    }
                                    unitsByParent={
                                        unitsByParent
                                    }
                                    expandedUnitIds={
                                        expandedUnitIds
                                    }
                                    selectedUnitId={
                                        selectedUnitId
                                    }
                                    handleToggleUnit={
                                        handleToggleUnit
                                    }
                                    handleSelectUnit={
                                        handleSelectUnit
                                    }
                                />
                            )
                        )}

                    </div>
                )}

        </div>
    );
};

export default OrganizationTreeNode;