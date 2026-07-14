// frontend/src/pages/Organization/components/MembersPanel.jsx

const MembersPanel = ({
    selectedUnit,

    filteredSelectedUnitMembers,

    memberSearch,
    setMemberSearch,

    editingMemberId,
    editingRole,
    setEditingRole,

    updatingMemberRole,

    movingMemberId,
    destinationUnitId,
    setDestinationUnitId,

    movingMember,

    removingMemberId,

    organizationUnits,

    handleEditMemberRole,
    handleCancelMemberRole,
    handleUpdateMemberRole,

    handleMoveMember,
    handleCancelMoveMember,
    handleUpdateMemberUnit,

    handleRemoveMember,
}) => {

    if (!selectedUnit) {
        return null;
    }


    return (
        <div className="organization-members-panel">

            <div className="organization-members-header">

                <h4>
                    Members
                </h4>

                <input
                    type="text"
                    value={
                        memberSearch
                    }
                    onChange={(e) =>
                        setMemberSearch(
                            e.target.value
                        )
                    }
                    placeholder="Search members..."
                />

            </div>


            {
                filteredSelectedUnitMembers.length === 0 ? (

                    <p>
                        No members found.
                    </p>

                ) : (

                    <div className="organization-members-list">

                        {
                            filteredSelectedUnitMembers.map(
                                (member) => (

                                    <div
                                        key={
                                            member.id
                                        }
                                        className="organization-member-card"
                                    >

                                        <div className="organization-member-info">

                                            <strong>
                                                {
                                                    member.fullName
                                                }
                                            </strong>

                                            <span>
                                                {
                                                    member.email
                                                }
                                            </span>

                                            <span>
                                                Role:
                                                {" "}
                                                {
                                                    member.role
                                                }
                                            </span>

                                        </div>


                                        <div className="organization-member-actions">


                                            {
                                                editingMemberId ===
                                                member.id ? (

                                                    <form
                                                        onSubmit={(e) =>
                                                            handleUpdateMemberRole(
                                                                e,
                                                                member.id
                                                            )
                                                        }
                                                        className="member-role-form"
                                                    >

                                                        <select
                                                            value={
                                                                editingRole
                                                            }
                                                            onChange={(e) =>
                                                                setEditingRole(
                                                                    e.target.value
                                                                )
                                                            }
                                                        >

                                                            <option value="OWNER">
                                                                OWNER
                                                            </option>

                                                            <option value="ADMIN">
                                                                ADMIN
                                                            </option>

                                                            <option value="MEMBER">
                                                                MEMBER
                                                            </option>

                                                        </select>


                                                        <button
                                                            type="submit"
                                                            disabled={
                                                                updatingMemberRole
                                                            }
                                                        >
                                                            {
                                                                updatingMemberRole
                                                                    ? "Saving..."
                                                                    : "Save"
                                                            }
                                                        </button>


                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleCancelMemberRole
                                                            }
                                                            disabled={
                                                                updatingMemberRole
                                                            }
                                                        >
                                                            Cancel
                                                        </button>

                                                    </form>

                                                ) : (

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleEditMemberRole(
                                                                member
                                                            )
                                                        }
                                                    >
                                                        Edit Role
                                                    </button>

                                                )

                                            }



                                            {
                                                movingMemberId ===
                                                member.id ? (

                                                    <form
                                                        onSubmit={(e) =>
                                                            handleUpdateMemberUnit(
                                                                e,
                                                                member.id
                                                            )
                                                        }
                                                        className="member-move-form"
                                                    >

                                                        <select
                                                            value={
                                                                destinationUnitId
                                                            }
                                                            onChange={(e) =>
                                                                setDestinationUnitId(
                                                                    e.target.value
                                                                )
                                                            }
                                                            required
                                                        >

                                                            <option value="">
                                                                Select Unit
                                                            </option>


                                                            {
                                                                organizationUnits
                                                                    .filter(
                                                                        (unit) =>
                                                                            unit.id !==
                                                                            selectedUnit.id
                                                                    )
                                                                    .map(
                                                                        (unit) => (

                                                                            <option
                                                                                key={
                                                                                    unit.id
                                                                                }
                                                                                value={
                                                                                    unit.id
                                                                                }
                                                                            >
                                                                                {
                                                                                    unit.name
                                                                                }
                                                                            </option>

                                                                        )
                                                                    )

                                                            }

                                                        </select>


                                                        <button
                                                            type="submit"
                                                            disabled={
                                                                movingMember
                                                            }
                                                        >
                                                            {
                                                                movingMember
                                                                    ? "Moving..."
                                                                    : "Move"
                                                            }
                                                        </button>


                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleCancelMoveMember
                                                            }
                                                            disabled={
                                                                movingMember
                                                            }
                                                        >
                                                            Cancel
                                                        </button>

                                                    </form>

                                                ) : (

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleMoveMember(
                                                                member
                                                            )
                                                        }
                                                    >
                                                        Move
                                                    </button>

                                                )

                                            }



                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleRemoveMember(
                                                        member
                                                    )
                                                }
                                                disabled={
                                                    removingMemberId ===
                                                    member.id
                                                }
                                            >
                                                {
                                                    removingMemberId ===
                                                    member.id
                                                        ? "Removing..."
                                                        : "Remove"
                                                }
                                            </button>


                                        </div>

                                    </div>

                                )
                            )
                        }

                    </div>

                )
            }

        </div>
    );
};

export default MembersPanel;