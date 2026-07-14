import { useMemo, useState } from "react";

import api from "../../../api/axios";

import {
    getValidDestinationUnits,
} from "../utils/organization.utils";

const useOrganizationUnitMove = ({
    organizationUnits,

    selectedUnit,

    setOrganizationUnits,

    setExpandedUnitIds,

    setCapacityData,

    onSuccess,

    setError,

    setMessage,
}) => {

    const [
        movingUnitId,
        setMovingUnitId,
    ] = useState(null);


    const [
        destinationParentId,
        setDestinationParentId,
    ] = useState("");


    const [
        movingUnit,
        setMovingUnit,
    ] = useState(false);



    const resetMoveEditor =
        () => {

            setMovingUnitId(
                null
            );

            setDestinationParentId(
                ""
            );
        };



    const validDestinationUnits =
        useMemo(() => {

            return getValidDestinationUnits(
                organizationUnits,
                selectedUnit
            );

        }, [
            organizationUnits,
            selectedUnit,
        ]);




    const handleMoveUnit =
        (
            unit
        ) => {

            setMovingUnitId(
                unit.id
            );

            setDestinationParentId(
                ""
            );

            setError("");
            setMessage("");
        };




    const handleCancelMoveUnit =
        () => {

            resetMoveEditor();
        };





    const handleUpdateUnitParent =
        async (
            event,
            unitId
        ) => {

            event.preventDefault();


            try {

                setMovingUnit(
                    true
                );

                setError("");
                setMessage("");



                const response =
                    await api.patch(
                        `/organization/units/${unitId}/move`,
                        {
                            parentId:
                                destinationParentId,
                        }
                    );



                const updatedUnit =
                    response.data.data;



                setOrganizationUnits(
                    (
                        currentUnits
                    ) =>
                        currentUnits.map(
                            (unit) =>
                                unit.id ===
                                unitId
                                    ? updatedUnit
                                    : unit
                        )
                );



                setExpandedUnitIds(
                    (
                        currentExpandedUnits
                    ) => {

                        if (
                            currentExpandedUnits.includes(
                                destinationParentId
                            )
                        ) {

                            return currentExpandedUnits;
                        }


                        return [
                            ...currentExpandedUnits,
                            destinationParentId,
                        ];

                    }
                );



                setCapacityData(
                    {}
                );



                resetMoveEditor();



                await onSuccess?.();



                setMessage(
                    "Organization unit moved successfully."
                );


            }
            catch(error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to move organization unit."
                );

            }
            finally {

                setMovingUnit(
                    false
                );

            }

        };



    return {

        movingUnitId,

        destinationParentId,

        movingUnit,

        validDestinationUnits,

        setDestinationParentId,

        resetMoveEditor,

        handleMoveUnit,

        handleCancelMoveUnit,

        handleUpdateUnitParent,

    };

};

export default useOrganizationUnitMove;