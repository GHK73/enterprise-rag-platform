import { useState } from "react";

import api from "../../../api/axios";

const useOrganizationCapacity = ({
    setError,

    setMessage,

    onSuccess,
}) => {

    const [
        capacityData,
        setCapacityData,
    ] = useState({});


    const [
        loadingCapacityId,
        setLoadingCapacityId,
    ] = useState(null);


    const [
        editingCapacityId,
        setEditingCapacityId,
    ] = useState(null);


    const [
        allocatedCapacity,
        setAllocatedCapacity,
    ] = useState("");


    const [
        updatingCapacity,
        setUpdatingCapacity,
    ] = useState(false);



    const resetCapacityEditor =
        () => {

            setEditingCapacityId(
                null
            );

            setAllocatedCapacity(
                ""
            );
        };



    const clearCapacityCache =
        () => {

            setCapacityData(
                {}
            );
        };



    const handleViewCapacity =
        async (
            unitId
        ) => {

            if (
                capacityData[unitId]
            ) {
                return;
            }


            try {

                setLoadingCapacityId(
                    unitId
                );


                setError("");
                setMessage("");



                const response =
                    await api.get(
                        `/organization/units/${unitId}/capacity`
                    );



                setCapacityData(
                    (
                        currentCapacity
                    ) => ({

                        ...currentCapacity,

                        [unitId]:
                            response.data.data,

                    })
                );

            }
            catch(error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to fetch organization capacity."
                );

            }
            finally {

                setLoadingCapacityId(
                    null
                );
            }

        };




    const handleEditCapacity =
        (
            unit
        ) => {

            const capacity =
                capacityData[
                    unit.id
                ];



            setEditingCapacityId(
                unit.id
            );



            setAllocatedCapacity(
                capacity
                    ?.allocatedCapacity ??
                    ""
            );



            setError("");
            setMessage("");

        };




    const handleCancelCapacity =
        () => {

            resetCapacityEditor();

        };




    const handleUpdateCapacity =
        async (
            event,
            unitId
        ) => {

            event.preventDefault();



            try {

                setUpdatingCapacity(
                    true
                );


                setError("");
                setMessage("");



                await api.patch(
                    `/organization/units/${unitId}/capacity`,
                    {
                        allocatedCapacity:
                            Number(
                                allocatedCapacity
                            ),
                    }
                );



                const response =
                    await api.get(
                        `/organization/units/${unitId}/capacity`
                    );



                setCapacityData(
                    (
                        currentCapacity
                    ) => ({

                        ...currentCapacity,

                        [unitId]:
                            response.data.data,

                    })
                );



                resetCapacityEditor();



                await onSuccess?.();



                setMessage(
                    "Organization unit capacity updated successfully."
                );

            }
            catch(error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to update organization capacity."
                );

            }
            finally {

                setUpdatingCapacity(
                    false
                );

            }

        };



    return {

        capacityData,

        setCapacityData,

        loadingCapacityId,

        editingCapacityId,

        allocatedCapacity,

        updatingCapacity,

        setAllocatedCapacity,

        resetCapacityEditor,

        clearCapacityCache,

        handleViewCapacity,

        handleEditCapacity,

        handleCancelCapacity,

        handleUpdateCapacity,

    };

};


export default useOrganizationCapacity;