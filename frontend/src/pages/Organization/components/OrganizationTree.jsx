import OrganizationTreeNode from "./OrganizationTreeNode.jsx";

const OrganizationTree = ({
    rootUnit,

    unitsByParent,

    expandedUnitIds,
    selectedUnitId,

    handleToggleUnit,
    handleSelectUnit,
}) => {
    if (!rootUnit) {
        return (
            <p className="organization-form-error">
                Company unit not found
            </p>
        );
    }

    return (
        <div className="organization-tree">

            <OrganizationTreeNode
                unit={rootUnit}
                depth={0}
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

        </div>
    );
};

export default OrganizationTree;