import { useEffect, useMemo, useState } from "react";

import {
    buildUnitsByParent,
    getRootUnit,
    getSelectedUnit,
} from "../utils/organization.utils";

const useOrganizationTree = (
    organizationUnits
) => {

    const [
        selectedUnitId,
        setSelectedUnitId,
    ] = useState(null);

    const [
        expandedUnitIds,
        setExpandedUnitIds,
    ] = useState([]);

    const unitsByParent =
        useMemo(() => {

            return buildUnitsByParent(
                organizationUnits
            );

        }, [
            organizationUnits,
        ]);

    const rootUnit =
        useMemo(() => {

            return getRootUnit(
                organizationUnits
            );

        }, [
            organizationUnits,
        ]);

    const selectedUnit =
        useMemo(() => {

            return getSelectedUnit(
                organizationUnits,
                selectedUnitId
            );

        }, [
            organizationUnits,
            selectedUnitId,
        ]);

    useEffect(() => {

        if (
            !rootUnit
        ) {
            return;
        }

        if (
            !selectedUnitId
        ) {

            setSelectedUnitId(
                rootUnit.id
            );
        }

    }, [
        rootUnit,
        selectedUnitId,
    ]);

    useEffect(() => {

        if (
            !selectedUnitId
        ) {
            return;
        }

        const exists =
            organizationUnits.some(
                (unit) =>
                    unit.id ===
                    selectedUnitId
            );

        if (
            !exists
        ) {

            setSelectedUnitId(
                rootUnit?.id ??
                null
            );
        }

    }, [
        organizationUnits,
        selectedUnitId,
        rootUnit,
    ]);

    const handleSelectUnit =
        (
            unit,
            callback
        ) => {

            setSelectedUnitId(
                unit.id
            );

            callback?.();
        };

    const handleToggleUnit =
        (
            unitId
        ) => {

            setExpandedUnitIds(
                (
                    currentExpandedUnits
                ) => {

                    if (
                        currentExpandedUnits.includes(
                            unitId
                        )
                    ) {

                        return currentExpandedUnits.filter(
                            (id) =>
                                id !==
                                unitId
                        );
                    }

                    return [
                        ...currentExpandedUnits,
                        unitId,
                    ];
                }
            );
        };

    const expandAll =
        () => {

            setExpandedUnitIds(
                organizationUnits.map(
                    (unit) =>
                        unit.id
                )
            );
        };

    const collapseAll =
        () => {

            setExpandedUnitIds(
                []
            );
        };

    return {

        rootUnit,

        selectedUnit,

        selectedUnitId,

        unitsByParent,

        expandedUnitIds,

        setSelectedUnitId,

        setExpandedUnitIds,

        handleSelectUnit,

        handleToggleUnit,

        expandAll,

        collapseAll,
    };
};

export default useOrganizationTree;