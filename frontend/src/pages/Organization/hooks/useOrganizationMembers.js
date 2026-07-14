import { useMemo, useState } from "react";

import api from "../../../api/axios";

const useOrganizationMembers = ({
    organizationMembers,
    setOrganizationMembers,

    selectedUnit,

    onSuccess,

    setError,
    setMessage,
}) => {

    const [
        editingMemberId,
        setEditingMemberId,
    ] = useState(null);

    const [
        editingRole,
        setEditingRole,
    ] = useState("");

    const [
        updatingMemberRole,
        setUpdatingMemberRole,
    ] = useState(false);

    const [
        movingMemberId,
        setMovingMemberId,
    ] = useState(null);

    const [
        destinationUnitId,
        setDestinationUnitId,
    ] = useState("");

    const [
        movingMember,
        setMovingMember,
    ] = useState(false);

    const [
        removingMemberId,
        setRemovingMemberId,
    ] = useState(null);

    const [
        memberSearch,
        setMemberSearch,
    ] = useState("");

    const resetMemberEditor =
        () => {

            setEditingMemberId(
                null
            );

            setEditingRole("");

            setMovingMemberId(
                null
            );

            setDestinationUnitId(
                ""
            );
        };

    const selectedUnitMembers =
        useMemo(() => {

            if (
                !selectedUnit
            ) {
                return [];
            }

            return organizationMembers.filter(
                (member) =>
                    member.unitId ===
                    selectedUnit.id
            );

        }, [
            organizationMembers,
            selectedUnit,
        ]);

    const filteredSelectedUnitMembers =
        useMemo(() => {

            const search =
                memberSearch
                    .trim()
                    .toLowerCase();

            if (!search) {
                return selectedUnitMembers;
            }

            return selectedUnitMembers.filter(
                (member) =>
                    member.fullName
                        .toLowerCase()
                        .includes(search) ||

                    member.email
                        .toLowerCase()
                        .includes(search)
            );

        }, [
            memberSearch,
            selectedUnitMembers,
        ]);

    const handleEditMemberRole =
        (member) => {

            resetMemberEditor();

            setEditingMemberId(
                member.id
            );

            setEditingRole(
                member.role
            );

            setError("");
            setMessage("");
        };

    const handleCancelMemberRole =
        () => {

            resetMemberEditor();
        };

    const handleUpdateMemberRole =
        async (
            event,
            memberId
        ) => {

            event.preventDefault();

            try {

                setUpdatingMemberRole(
                    true
                );

                setError("");
                setMessage("");

                const response =
                    await api.patch(
                        `/organization/members/${memberId}/role`,
                        {
                            role:
                                editingRole,
                        }
                    );

                const updatedMember =
                    response.data.data;

                setOrganizationMembers(
                    (
                        currentMembers
                    ) =>
                        currentMembers.map(
                            (member) =>
                                member.id ===
                                memberId
                                    ? updatedMember
                                    : member
                        )
                );

                resetMemberEditor();

                if (
                    onSuccess
                ) {

                    await onSuccess();
                }

                setMessage(
                    "Member role updated successfully."
                );
            }
            catch (error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to update member role."
                );
            }
            finally {

                setUpdatingMemberRole(
                    false
                );
            }
        };

    const handleMoveMember =
        (member) => {

            resetMemberEditor();

            setMovingMemberId(
                member.id
            );

            setError("");
            setMessage("");
        };

    const handleCancelMoveMember =
        () => {

            resetMemberEditor();
        };

    const handleUpdateMemberUnit =
        async (
            event,
            memberId
        ) => {

            event.preventDefault();

            try {

                setMovingMember(
                    true
                );

                setError("");
                setMessage("");

                const response =
                    await api.patch(
                        `/organization/members/${memberId}/unit`,
                        {
                            unitId:
                                destinationUnitId,
                        }
                    );

                const updatedMember =
                    response.data.data;

                setOrganizationMembers(
                    (
                        currentMembers
                    ) =>
                        currentMembers.map(
                            (member) =>
                                member.id ===
                                memberId
                                    ? updatedMember
                                    : member
                        )
                );

                resetMemberEditor();

                if (
                    onSuccess
                ) {

                    await onSuccess();
                }

                setMessage(
                    "Member moved successfully."
                );
            }
            catch (error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to move member."
                );
            }
            finally {

                setMovingMember(
                    false
                );
            }
        };

    const handleRemoveMember =
        async (
            member
        ) => {

            const confirmed =
                window.confirm(
                    `Are you sure you want to remove ${member.fullName}?`
                );

            if (
                !confirmed
            ) {
                return;
            }

            try {

                setRemovingMemberId(
                    member.id
                );

                setError("");
                setMessage("");

                await api.delete(
                    `/organization/members/${member.id}`
                );

                setOrganizationMembers(
                    (
                        currentMembers
                    ) =>
                        currentMembers.filter(
                            (
                                currentMember
                            ) =>
                                currentMember.id !==
                                member.id
                        )
                );

                resetMemberEditor();

                if (
                    onSuccess
                ) {

                    await onSuccess();
                }

                setMessage(
                    "Member removed successfully."
                );
            }
            catch (error) {

                setError(
                    error.response?.data
                        ?.message ||
                    "Failed to remove member."
                );
            }
            finally {

                setRemovingMemberId(
                    null
                );
            }
        };

    return {

        editingMemberId,
        editingRole,

        updatingMemberRole,

        movingMemberId,
        destinationUnitId,

        movingMember,

        removingMemberId,

        memberSearch,

        selectedUnitMembers,
        filteredSelectedUnitMembers,

        setEditingRole,
        setDestinationUnitId,
        setMemberSearch,

        resetMemberEditor,

        handleEditMemberRole,
        handleCancelMemberRole,
        handleUpdateMemberRole,

        handleMoveMember,
        handleCancelMoveMember,
        handleUpdateMemberUnit,

        handleRemoveMember,
    };
};

export default useOrganizationMembers;