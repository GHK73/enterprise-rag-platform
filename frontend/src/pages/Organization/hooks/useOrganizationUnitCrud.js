import { useMemo, useState } from "react";

import api from "../../../api/axios";

import {
    getAvailableParentUnits,
    getChildType,
} from "../utils/organization.utils";

const useOrganizationUnitCrud = ({
    organizationUnits,

    setOrganizationUnits,

    rootUnit,

    setSelectedUnitId,

    setExpandedUnitIds,

    setCapacityData,

    onSuccess,

    setError,

    setMessage,
}) => {

    const [name, setName] =
        useState("");

    const [parentId, setParentId] =
        useState("");

    const [creating, setCreating] =
        useState(false);

    const [
        editingUnitId,
        setEditingUnitId,
    ] = useState(null);

    const [
        editingName,
        setEditingName,
    ] = useState("");

    const [updating, setUpdating] =
        useState(false);

    const [
        deletingUnitId,
        setDeletingUnitId,
    ] = useState(null);


    const resetUnitEditor =
        () => {

            setEditingUnitId(
                null
            );

            setEditingName(
                ""
            );

            setName(
                ""
            );

            setParentId(
                ""
            );
        };


    const availableParentUnits =
        useMemo(() => {

            return getAvailableParentUnits(
                organizationUnits
            );

        }, [
            organizationUnits,
        ]);


    const selectedParentUnit =
        useMemo(() => {

            return organizationUnits.find(
                (unit) =>
                    unit.id ===
                    parentId
            );

        }, [
            organizationUnits,
            parentId,
        ]);


    const childType =
        useMemo(() => {

            if (
                !selectedParentUnit
            ) {
                return null;
            }

            return getChildType(
                selectedParentUnit.type
            );

        }, [
            selectedParentUnit,
        ]);


    const handleCreateUnit =
        async (
            event
        ) => {

            event.preventDefault();

            const parentUnit =
                organizationUnits.find(
                    (unit) =>
                        unit.id ===
                        parentId
                );


            if (
                !parentUnit
            ) {

                setError(
                    "Parent organization unit not found."
                );

                return;
            }


            const type =
                getChildType(
                    parentUnit.type
                );


            if (
                !type
            ) {

                setError(
                    "Groups cannot contain child units."
                );

                return;
            }


            try {

                setCreating(
                    true
                );

                setError("");
                setMessage("");


                const response =
                    await api.post(
                        "/organization/units",
                        {
                            name,
                            type,
                            parentId,
                        }
                    );


                const createdUnit =
                    response.data.data;


                setOrganizationUnits(
                    (
                        currentUnits
                    ) => [
                        ...currentUnits,
                        createdUnit,
                    ]
                );


                setExpandedUnitIds(
                    (
                        currentExpandedUnits
                    ) => {

                        if (
                            currentExpandedUnits.includes(
                                parentId
                            )
                        ) {
                            return currentExpandedUnits;
                        }


                        return [
                            ...currentExpandedUnits,
                            parentId,
                        ];
                    }
                );


                setSelectedUnitId(
                    createdUnit.id
                );


                resetUnitEditor();


                await onSuccess?.();


                setMessage(
                    `${type} created successfully.`
                );

            }
            catch(error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to create organization unit."
                );

            }
            finally {

                setCreating(
                    false
                );
            }
        };


    const handleEditUnit =
        (
            unit
        ) => {

            setEditingUnitId(
                unit.id
            );

            setEditingName(
                unit.name
            );

            setError("");
            setMessage("");
        };


    const handleCancelEdit =
        () => {

            setEditingUnitId(
                null
            );

            setEditingName(
                ""
            );
        };


    const handleUpdateUnit =
        async (
            event,
            unitId
        ) => {

            event.preventDefault();


            try {

                setUpdating(
                    true
                );

                setError("");
                setMessage("");


                const response =
                    await api.patch(
                        `/organization/units/${unitId}`,
                        {
                            name:
                                editingName,
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


                resetUnitEditor();


                await onSuccess?.();


                setMessage(
                    "Organization unit updated successfully."
                );

            }
            catch(error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to update organization unit."
                );

            }
            finally {

                setUpdating(
                    false
                );
            }
        };


    const handleDeleteUnit =
        async (
            unit
        ) => {

            const confirmed =
                window.confirm(
                    `Are you sure you want to delete ${unit.name}?`
                );


            if(
                !confirmed
            ) {
                return;
            }


            try {

                setDeletingUnitId(
                    unit.id
                );

                setError("");
                setMessage("");


                await api.delete(
                    `/organization/units/${unit.id}`
                );


                setOrganizationUnits(
                    (
                        currentUnits
                    ) =>
                        currentUnits.filter(
                            (currentUnit) =>
                                currentUnit.id !==
                                unit.id
                        )
                );


                setExpandedUnitIds(
                    (
                        currentExpandedUnits
                    ) =>
                        currentExpandedUnits.filter(
                            (id) =>
                                id !==
                                unit.id
                        )
                );


                setCapacityData(
                    (
                        currentCapacity
                    ) => {

                        const updated =
                        {
                            ...currentCapacity,
                        };


                        delete updated[
                            unit.id
                        ];


                        return updated;
                    }
                );


                setSelectedUnitId(
                    unit.parentId ||
                    rootUnit?.id ||
                    null
                );


                resetUnitEditor();


                await onSuccess?.();


                setMessage(
                    "Organization unit deleted successfully."
                );

            }
            catch(error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to delete organization unit."
                );

            }
            finally {

                setDeletingUnitId(
                    null
                );
            }
        };


    return {

        name,
        setName,

        parentId,
        setParentId,

        creating,

        editingUnitId,

        editingName,

        setEditingName,

        updating,

        deletingUnitId,

        availableParentUnits,

        childType,

        resetUnitEditor,

        handleCreateUnit,

        handleEditUnit,

        handleCancelEdit,

        handleUpdateUnit,

        handleDeleteUnit,
    };
};

export default useOrganizationUnitCrud;