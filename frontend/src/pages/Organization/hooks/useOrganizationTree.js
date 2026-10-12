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
        async function sync() {
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
        }
        sync();
    }, [
        rootUnit,
        selectedUnitId,
    ]);

    useEffect(() => {
        async function sync() {
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
        }
        sync();
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
    };
};

export default useOrganizationTree;