export const buildUnitsByParent = (
    organizationUnits
) => {

    const unitsByParent = {};

    organizationUnits.forEach(
        (unit) => {

            const parentId =
                unit.parentId ??
                "root";

            if (
                !unitsByParent[parentId]
            ) {

                unitsByParent[parentId] =
                    [];
            }

            unitsByParent[parentId].push(
                unit
            );
        }
    );

    return unitsByParent;
};

export const getRootUnit = (
    organizationUnits
) => {

    return (
        organizationUnits.find(
            (unit) =>
                unit.type ===
                "COMPANY"
        ) ?? null
    );
};

export const getSelectedUnit = (
    organizationUnits,
    selectedUnitId
) => {

    return (
        organizationUnits.find(
            (unit) =>
                unit.id ===
                selectedUnitId
        ) ?? null
    );
};

export const getChildType = (
    parentType
) => {

    const hierarchy = {
        COMPANY: "DEPARTMENT",
        DEPARTMENT: "TEAM",
        TEAM: "GROUP",
    };

    return (
        hierarchy[parentType] ??
        null
    );
};

export const getValidParentType = (
    unitType
) => {

    const hierarchy = {
        DEPARTMENT: "COMPANY",
        TEAM: "DEPARTMENT",
        GROUP: "TEAM",
    };

    return (
        hierarchy[unitType] ??
        null
    );
};

export const isRootUnit = (
    unit
) => {

    return (
        unit?.type ===
        "COMPANY"
    );
};

export const unitExists = (
    organizationUnits,
    unitId
) => {

    return organizationUnits.some(
        (unit) =>
            unit.id ===
            unitId
    );
};

export const getUnitById = (
    organizationUnits,
    unitId
) => {

    return (
        organizationUnits.find(
            (unit) =>
                unit.id ===
                unitId
        ) ?? null
    );
};

export const getAvailableParentUnits = (
    organizationUnits
) => {

    return organizationUnits.filter(
        (unit) =>
            unit.type !==
            "GROUP"
    );
};

export const getValidDestinationUnits = (
    organizationUnits,
    selectedUnit
) => {

    if (
        !selectedUnit
    ) {
        return [];
    }

    const validParentType =
        getValidParentType(
            selectedUnit.type
        );

    return organizationUnits.filter(
        (unit) =>
            unit.type ===
                validParentType &&
            unit.id !==
                selectedUnit.parentId
    );
};

export const sortUnitsByHierarchy = (
    organizationUnits
) => {

    const order = {
        COMPANY: 0,
        DEPARTMENT: 1,
        TEAM: 2,
        GROUP: 3,
    };

    return [
        ...organizationUnits,
    ].sort(
        (a, b) =>
            order[a.type] -
            order[b.type]
    );
};