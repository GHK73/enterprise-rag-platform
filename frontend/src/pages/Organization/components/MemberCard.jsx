// frontend/src/pages/Organization/components/MemberCard.jsx

const MemberCard = ({
    member,

    organizationUnits,

    editingMemberId,
    editingRole,
    setEditingRole,

    updatingMemberRole,

    movingMemberId,
    destinationUnitId,
    setDestinationUnitId,

    movingMember,
    removingMemberId,

    handleUpdateMemberRole,
    handleCancelMemberRole,

    handleUpdateMemberUnit,
    handleCancelMoveMember,

    handleEditMemberRole,
    handleMoveMember,
    handleRemoveMember,
}) => {

    const isEditingMember =
        editingMemberId === member.id;

    const isMovingMember =
        movingMemberId === member.id;


    return (

        <article
            className="organization-member-card"
        >

            <div
                className="organization-member-info"
            >

                <div
                    className="organization-member-icon"
                >
                    {
                        member.fullName
                            ?.charAt(0)
                            ?.toUpperCase()
                    }
                </div>


                <div>

                    <h3>
                        {
                            member.fullName
                        }
                    </h3>


                    <p>
                        {
                            member.email
                        }
                    </p>


                    <span>
                        {
                            member.role
                        }
                    </span>

                </div>

            </div>


            {
                isEditingMember ? (

                    <form
                        className="organization-member-role-form"
                        onSubmit={(event) =>
                            handleUpdateMemberRole(
                                event,
                                member.id
                            )
                        }
                    >

                        <select
                            value={
                                editingRole
                            }
                            onChange={(event) =>
                                setEditingRole(
                                    event.target.value
                                )
                            }
                            required
                        >

                            <option value="OWNER">
                                OWNER
                            </option>

                            <option value="ADMIN">
                                ADMIN
                            </option>

                            <option value="MANAGER">
                                MANAGER
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


                ) : isMovingMember ? (


                    <form
                        className="organization-member-move-form"
                        onSubmit={(event) =>
                            handleUpdateMemberUnit(
                                event,
                                member.id
                            )
                        }
                    >

                        <select
                            value={
                                destinationUnitId
                            }
                            onChange={(event) =>
                                setDestinationUnitId(
                                    event.target.value
                                )
                            }
                            required
                        >

                            <option value="">
                                Select destination unit
                            </option>


                            {
                                organizationUnits
                                    .filter(
                                        (unit) =>
                                            unit.id !==
                                            member.unitId
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

                                                {" "}

                                                (
                                                {
                                                    unit.type
                                                }
                                                )

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


                    <div
                        className="organization-member-actions"
                    >

                        <span
                            className="organization-member-role-badge"
                        >
                            {
                                member.role
                            }
                        </span>


                        {
                            member.role !==
                            "OWNER" && (

                                <>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleEditMemberRole(
                                                member
                                            )
                                        }
                                        disabled={
                                            removingMemberId ===
                                            member.id
                                        }
                                    >
                                        Role
                                    </button>


                                    <button
                                        className="organization-member-move-button"
                                        type="button"
                                        onClick={() =>
                                            handleMoveMember(
                                                member
                                            )
                                        }
                                        disabled={
                                            removingMemberId ===
                                            member.id
                                        }
                                    >
                                        Move
                                    </button>


                                    <button
                                        className="organization-member-remove-button"
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

                                </>

                            )
                        }


                    </div>

                )
            }


        </article>

    );
};

export default MemberCard;