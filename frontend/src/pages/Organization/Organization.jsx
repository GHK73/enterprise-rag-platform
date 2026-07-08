import {useEffect,useState} from "react";
import api from "../../api/axios";
import "./Organization.css";

function Organization(){
    const [organization,setOrganization] = useState(null);
    const [organizationUnits,setOrganizationUnits] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");
    const [message,setMessage] = useState("");

    const [name,setName] = useState("");
    const [parentId,setParentId] = useState("");
    const [creating,setCreating] = useState(false);

    const [editingUnitId,setEditingUnitId] = useState(null);
    const [editingName,setEditingName] = useState("");
    const [updating,setUpdating] = useState(false);
    const [deletingUnitId,setDeletingUnitId] = useState(null);

    const [movingUnitId,setMovingUnitId] = useState(null);
    const [destinationParentId,setDestinationParentId] = useState("");
    const [movingUnit,setMovingUnit] = useState(false);

    const [capacityData,setCapacityData] = useState({});
    const [loadingCapacityId,setLoadingCapacityId] = useState(null);
    const [editingCapacityId,setEditingCapacityId] = useState(null);
    const [allocatedCapacity,setAllocatedCapacity] = useState("");
    const [updatingCapacity,setUpdatingCapacity] = useState(false);

    const [organizationMembers,setOrganizationMembers] = useState([]);
    const [editingMemberId,setEditingMemberId] = useState(null);
    const [editingRole,setEditingRole] = useState("");
    const [updatingMemberRole,setUpdatingMemberRole] = useState(false);
    const [movingMemberId,setMovingMemberId] = useState(null);
    const [destinationUnitId,setDestinationUnitId] = useState("");
    const [movingMember,setMovingMember] = useState(false);
    const [removingMemberId,setRemovingMemberId] = useState(null);

    useEffect(()=>{
        const fetchOrganizationData = async()=>{
            try{
                const [
                    organizationResponse,
                    unitsResponse,
                    membersResponse
                ] = await Promise.all([
                    api.get("/organization"),
                    api.get("/organization/units"),
                    api.get("/organization/members")
                ]);

                setOrganization(organizationResponse.data.data);
                setOrganizationUnits(unitsResponse.data.data);
                setOrganizationMembers(membersResponse.data.data);
            }
            catch(error){
                setError(
                    error.response?.data?.message ||
                    "Failed to fetch organization data"
                );
            }
            finally{
                setLoading(false);
            }
        };

        fetchOrganizationData();
    },[]);

    const getChildType = (parentType)=>{
        const hierarchy = {
            COMPANY:"DEPARTMENT",
            DEPARTMENT:"TEAM",
            TEAM:"GROUP"
        };

        return hierarchy[parentType];
    };

    const getValidParentType = (unitType)=>{
        const hierarchy = {
            DEPARTMENT:"COMPANY",
            TEAM:"DEPARTMENT",
            GROUP:"TEAM"
        };

        return hierarchy[unitType];
    };

    const handleCreateUnit = async(e)=>{
        e.preventDefault();

        const parentUnit = organizationUnits.find(
            (unit)=>unit.id === parentId
        );

        if(!parentUnit){
            setError("Parent organization unit not found");
            return;
        }

        const type = getChildType(parentUnit.type);

        if(!type){
            setError("Groups cannot contain child units");
            return;
        }

        try{
            setCreating(true);
            setError("");
            setMessage("");

            const response = await api.post(
                "/organization/units",
                {
                    name,
                    type,
                    parentId:parentUnit.id
                }
            );

            setOrganizationUnits((currentUnits)=>[
                ...currentUnits,
                response.data.data
            ]);

            setName("");
            setParentId("");
            setMessage(`${type} created successfully`);
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to create organization unit"
            );
        }
        finally{
            setCreating(false);
        }
    };

    const handleEditUnit = (unit)=>{
        setEditingUnitId(unit.id);
        setEditingName(unit.name);
        setMovingUnitId(null);
        setDestinationParentId("");
        setError("");
        setMessage("");
    };

    const handleCancelEdit = ()=>{
        setEditingUnitId(null);
        setEditingName("");
    };

    const handleUpdateUnit = async(e,unitId)=>{
        e.preventDefault();

        try{
            setUpdating(true);
            setError("");
            setMessage("");

            const response = await api.patch(
                `/organization/units/${unitId}`,
                {
                    name:editingName
                }
            );

            setOrganizationUnits((currentUnits)=>
                currentUnits.map((unit)=>
                    unit.id === unitId
                        ? response.data.data
                        : unit
                )
            );

            setEditingUnitId(null);
            setEditingName("");
            setMessage("Organization unit updated successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to update organization unit"
            );
        }
        finally{
            setUpdating(false);
        }
    };

    const handleMoveUnit = (unit)=>{
        setMovingUnitId(unit.id);
        setDestinationParentId("");
        setEditingUnitId(null);
        setEditingName("");
        setError("");
        setMessage("");
    };

    const handleCancelMoveUnit = ()=>{
        setMovingUnitId(null);
        setDestinationParentId("");
    };

    const handleUpdateUnitParent = async(e,unitId)=>{
        e.preventDefault();

        try{
            setMovingUnit(true);
            setError("");
            setMessage("");

            const response = await api.patch(
                `/organization/units/${unitId}/move`,
                {
                    parentId:destinationParentId
                }
            );

            setOrganizationUnits((currentUnits)=>
                currentUnits.map((unit)=>
                    unit.id === unitId
                        ? response.data.data
                        : unit
                )
            );

            setMovingUnitId(null);
            setDestinationParentId("");
            setCapacityData({});
            setMessage("Organization unit moved successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to move organization unit"
            );
        }
        finally{
            setMovingUnit(false);
        }
    };

    const handleDeleteUnit = async(unit)=>{
        const confirmed = window.confirm(
            `Are you sure you want to delete ${unit.name}?`
        );

        if(!confirmed){
            return;
        }

        try{
            setDeletingUnitId(unit.id);
            setError("");
            setMessage("");

            await api.delete(
                `/organization/units/${unit.id}`
            );

            setOrganizationUnits((currentUnits)=>
                currentUnits.filter(
                    (currentUnit)=>currentUnit.id !== unit.id
                )
            );

            setMessage("Organization unit deleted successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to delete organization unit"
            );
        }
        finally{
            setDeletingUnitId(null);
        }
    };

    const handleViewCapacity = async(unitId)=>{
        try{
            setLoadingCapacityId(unitId);
            setError("");
            setMessage("");

            const response = await api.get(
                `/organization/units/${unitId}/capacity`
            );

            setCapacityData((currentCapacity)=>({
                ...currentCapacity,
                [unitId]:response.data.data
            }));
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to fetch organization unit capacity"
            );
        }
        finally{
            setLoadingCapacityId(null);
        }
    };

    const handleEditCapacity = (unit)=>{
        const unitCapacity = capacityData[unit.id];

        setEditingCapacityId(unit.id);
        setAllocatedCapacity(
            unitCapacity?.allocatedCapacity ?? ""
        );
        setError("");
        setMessage("");
    };

    const handleUpdateCapacity = async(e,unitId)=>{
        e.preventDefault();

        try{
            setUpdatingCapacity(true);
            setError("");
            setMessage("");

            await api.patch(
                `/organization/units/${unitId}/capacity`,
                {
                    allocatedCapacity:Number(allocatedCapacity)
                }
            );

            const response = await api.get(
                `/organization/units/${unitId}/capacity`
            );

            setCapacityData((currentCapacity)=>({
                ...currentCapacity,
                [unitId]:response.data.data
            }));

            setEditingCapacityId(null);
            setAllocatedCapacity("");
            setMessage(
                "Organization unit capacity updated successfully"
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to update organization unit capacity"
            );
        }
        finally{
            setUpdatingCapacity(false);
        }
    };

    const handleEditMemberRole = (member)=>{
        setEditingMemberId(member.id);
        setEditingRole(member.role);
        setMovingMemberId(null);
        setDestinationUnitId("");
        setError("");
        setMessage("");
    };

    const handleCancelMemberRole = ()=>{
        setEditingMemberId(null);
        setEditingRole("");
    };

    const handleUpdateMemberRole = async(e,memberId)=>{
        e.preventDefault();

        try{
            setUpdatingMemberRole(true);
            setError("");
            setMessage("");

            const response = await api.patch(
                `/organization/members/${memberId}/role`,
                {
                    role:editingRole
                }
            );

            setOrganizationMembers((currentMembers)=>
                currentMembers.map((member)=>
                    member.id === memberId
                        ? response.data.data
                        : member
                )
            );

            setEditingMemberId(null);
            setEditingRole("");
            setMessage("Member role updated successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to update member role"
            );
        }
        finally{
            setUpdatingMemberRole(false);
        }
    };

    const handleMoveMember = (member)=>{
        setMovingMemberId(member.id);
        setDestinationUnitId("");
        setEditingMemberId(null);
        setEditingRole("");
        setError("");
        setMessage("");
    };

    const handleCancelMoveMember = ()=>{
        setMovingMemberId(null);
        setDestinationUnitId("");
    };

    const handleUpdateMemberUnit = async(e,memberId)=>{
        e.preventDefault();

        try{
            setMovingMember(true);
            setError("");
            setMessage("");

            const response = await api.patch(
                `/organization/members/${memberId}/unit`,
                {
                    unitId:destinationUnitId
                }
            );

            setOrganizationMembers((currentMembers)=>
                currentMembers.map((member)=>
                    member.id === memberId
                        ? response.data.data
                        : member
                )
            );

            setMovingMemberId(null);
            setDestinationUnitId("");
            setMessage("Member moved successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to move member"
            );
        }
        finally{
            setMovingMember(false);
        }
    };

    const handleRemoveMember = async(member)=>{
        const confirmed = window.confirm(
            `Are you sure you want to remove ${member.fullName} from the organization?`
        );

        if(!confirmed){
            return;
        }

        try{
            setRemovingMemberId(member.id);
            setError("");
            setMessage("");

            await api.delete(
                `/organization/members/${member.id}`
            );

            setOrganizationMembers((currentMembers)=>
                currentMembers.filter(
                    (currentMember)=>
                        currentMember.id !== member.id
                )
            );

            setMessage("Member removed successfully");
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to remove member"
            );
        }
        finally{
            setRemovingMemberId(null);
        }
    };

    const renderOrganizationUnit = (unit)=>{
        const childUnits = organizationUnits.filter(
            (childUnit)=>childUnit.parentId === unit.id
        );

        const isEditing = editingUnitId === unit.id;
        const isMovingUnit = movingUnitId === unit.id;
        const unitCapacity = capacityData[unit.id];
        const isEditingCapacity =
            editingCapacityId === unit.id;

        const validParentType =
            getValidParentType(unit.type);

        const validDestinationUnits =
            organizationUnits.filter(
                (destinationUnit)=>
                    destinationUnit.type === validParentType &&
                    destinationUnit.id !== unit.parentId
            );

        return (
            <div
                className="organization-unit-tree"
                key={unit.id}
            >
                <article className="organization-unit-card">
                    <div className="organization-unit-icon">
                        {unit.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="organization-unit-content">
                        {isEditing ? (
                            <form
                                className="organization-unit-edit-form"
                                onSubmit={(e)=>
                                    handleUpdateUnit(e,unit.id)
                                }
                            >
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e)=>
                                        setEditingName(e.target.value)
                                    }
                                    required
                                    autoFocus
                                />

                                <button
                                    type="submit"
                                    disabled={updating}
                                >
                                    {updating
                                        ? "Saving..."
                                        : "Save"
                                    }
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={updating}
                                >
                                    Cancel
                                </button>
                            </form>
                        ) : isMovingUnit ? (
                            <form
                                className="organization-unit-move-form"
                                onSubmit={(e)=>
                                    handleUpdateUnitParent(
                                        e,
                                        unit.id
                                    )
                                }
                            >
                                <select
                                    value={destinationParentId}
                                    onChange={(e)=>
                                        setDestinationParentId(
                                            e.target.value
                                        )
                                    }
                                    required
                                    autoFocus
                                >
                                    <option value="">
                                        Select new parent
                                    </option>

                                    {validDestinationUnits.map(
                                        (destinationUnit)=>(
                                            <option
                                                key={destinationUnit.id}
                                                value={destinationUnit.id}
                                            >
                                                {destinationUnit.name}
                                                {" "}
                                                ({destinationUnit.type})
                                            </option>
                                        )
                                    )}
                                </select>

                                <button
                                    type="submit"
                                    disabled={movingUnit}
                                >
                                    {movingUnit
                                        ? "Moving..."
                                        : "Move"
                                    }
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCancelMoveUnit}
                                    disabled={movingUnit}
                                >
                                    Cancel
                                </button>
                            </form>
                        ) : (
                            <>
                                <h3>{unit.name}</h3>

                                <span className="organization-unit-type">
                                    {unit.type}
                                </span>
                            </>
                        )}
                    </div>

                    {!isEditing && !isMovingUnit && (
                        <div className="organization-unit-actions">
                            <button
                                className="organization-unit-capacity-button"
                                type="button"
                                onClick={()=>
                                    handleViewCapacity(unit.id)
                                }
                                disabled={
                                    loadingCapacityId === unit.id
                                }
                            >
                                {loadingCapacityId === unit.id
                                    ? "Loading..."
                                    : "Capacity"
                                }
                            </button>

                            {unit.type !== "COMPANY" && (
                                <>
                                    <button
                                        className="organization-unit-edit-button"
                                        type="button"
                                        onClick={()=>
                                            handleEditUnit(unit)
                                        }
                                        disabled={
                                            deletingUnitId === unit.id
                                        }
                                    >
                                        Edit
                                    </button>

                                    <button
                                        className="organization-unit-move-button"
                                        type="button"
                                        onClick={()=>
                                            handleMoveUnit(unit)
                                        }
                                        disabled={
                                            deletingUnitId === unit.id
                                        }
                                    >
                                        Move Unit
                                    </button>

                                    <button
                                        className="organization-unit-delete-button"
                                        type="button"
                                        onClick={()=>
                                            handleDeleteUnit(unit)
                                        }
                                        disabled={
                                            deletingUnitId === unit.id
                                        }
                                    >
                                        {deletingUnitId === unit.id
                                            ? "Deleting..."
                                            : "Delete"
                                        }
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </article>

                {unitCapacity && (
                    <div className="organization-unit-capacity">
                        {isEditingCapacity ? (
                            <form
                                className="organization-capacity-form"
                                onSubmit={(e)=>
                                    handleUpdateCapacity(e,unit.id)
                                }
                            >
                                <input
                                    type="number"
                                    min="1"
                                    value={allocatedCapacity}
                                    onChange={(e)=>
                                        setAllocatedCapacity(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Enter capacity"
                                    required
                                />

                                <button
                                    type="submit"
                                    disabled={updatingCapacity}
                                >
                                    {updatingCapacity
                                        ? "Saving..."
                                        : "Save"
                                    }
                                </button>

                                <button
                                    type="button"
                                    onClick={()=>{
                                        setEditingCapacityId(null);
                                        setAllocatedCapacity("");
                                    }}
                                    disabled={updatingCapacity}
                                >
                                    Cancel
                                </button>
                            </form>
                        ) : (
                            <>
                                <div>
                                    <span>Allocated</span>

                                    <strong>
                                        {unitCapacity.allocatedCapacity
                                            ?? "Not set"
                                        }
                                    </strong>
                                </div>

                                <div>
                                    <span>Direct Members</span>

                                    <strong>
                                        {unitCapacity.directMembers}
                                    </strong>
                                </div>

                                <div>
                                    <span>Child Allocations</span>

                                    <strong>
                                        {unitCapacity.childAllocations}
                                    </strong>
                                </div>

                                <div>
                                    <span>Remaining</span>

                                    <strong>
                                        {unitCapacity.remainingCapacity
                                            ?? "Not set"
                                        }
                                    </strong>
                                </div>

                                <button
                                    className="organization-capacity-edit-button"
                                    type="button"
                                    onClick={()=>
                                        handleEditCapacity(unit)
                                    }
                                >
                                    Set / Update
                                </button>
                            </>
                        )}
                    </div>
                )}

                {childUnits.length > 0 && (
                    <div className="organization-unit-children">
                        {childUnits.map((childUnit)=>
                            renderOrganizationUnit(childUnit)
                        )}
                    </div>
                )}
            </div>
        );
    };

    const rootUnit = organizationUnits.find(
        (unit)=>unit.type === "COMPANY"
    );

    const availableParentUnits = organizationUnits.filter(
        (unit)=>unit.type !== "GROUP"
    );

    const selectedParentUnit = organizationUnits.find(
        (unit)=>unit.id === parentId
    );

    const childType = selectedParentUnit
        ? getChildType(selectedParentUnit.type)
        : null;

    if(loading){
        return (
            <div className="organization-state">
                <p>Loading organization...</p>
            </div>
        );
    }

    if(error && !organization){
        return (
            <div className="organization-state organization-error">
                <p>{error}</p>
            </div>
        );
    }

    return (
        <main className="organization-page">
            <div className="organization-container">
                <header className="organization-header">
                    <p className="organization-eyebrow">
                        Organization Management
                    </p>

                    <h1>{organization.name}</h1>

                    <p className="organization-description">
                        {organization.description || "No description"}
                    </p>
                </header>

                <section className="organization-section">
                    <div className="organization-section-header">
                        <div>
                            <h2>Organization Structure</h2>

                            <p>
                                Create, update, reorganize, and manage
                                departments, teams, and groups.
                            </p>
                        </div>
                    </div>

                    {message && (
                        <p className="organization-success">
                            {message}
                        </p>
                    )}

                    {error && (
                        <p className="organization-form-error">
                            {error}
                        </p>
                    )}

                    <form
                        className="organization-create-form"
                        onSubmit={handleCreateUnit}
                    >
                        <div className="organization-form-field">
                            <label htmlFor="parent-unit">
                                Parent Unit
                            </label>

                            <select
                                id="parent-unit"
                                value={parentId}
                                onChange={(e)=>
                                    setParentId(e.target.value)
                                }
                                required
                            >
                                <option value="">
                                    Select parent unit
                                </option>

                                {availableParentUnits.map((unit)=>(
                                    <option
                                        key={unit.id}
                                        value={unit.id}
                                    >
                                        {unit.name} ({unit.type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="organization-form-field">
                            <label htmlFor="unit-name">
                                {childType
                                    ? `Create ${childType}`
                                    : "Organization Unit"
                                }
                            </label>

                            <input
                                id="unit-name"
                                type="text"
                                placeholder="Enter unit name"
                                value={name}
                                onChange={(e)=>
                                    setName(e.target.value)
                                }
                                required
                            />
                        </div>

                        <button
                            className="organization-create-button"
                            type="submit"
                            disabled={creating || !childType}
                        >
                            {creating
                                ? "Creating..."
                                : childType
                                    ? `Add ${childType}`
                                    : "Select Parent"
                            }
                        </button>
                    </form>

                    <div className="organization-units">
                        {rootUnit
                            ? renderOrganizationUnit(rootUnit)
                            : (
                                <p className="organization-form-error">
                                    Company unit not found
                                </p>
                            )
                        }
                    </div>
                </section>

                <section className="organization-section">
                    <div className="organization-section-header">
                        <div>
                            <h2>Member Management</h2>

                            <p>
                                View organization members, update their
                                roles, move them between units, and
                                remove them from the organization.
                            </p>
                        </div>
                    </div>

                    <div className="organization-members">
                        {organizationMembers.map((member)=>{
                            const isEditingMember =
                                editingMemberId === member.id;

                            const isMovingMember =
                                movingMemberId === member.id;

                            return (
                                <article
                                    className="organization-member-card"
                                    key={member.id}
                                >
                                    <div className="organization-member-info">
                                        <div className="organization-member-icon">
                                            {member.fullName
                                                .charAt(0)
                                                .toUpperCase()
                                            }
                                        </div>

                                        <div>
                                            <h3>{member.fullName}</h3>

                                            <p>{member.email}</p>

                                            <span>
                                                {member.unit?.name
                                                    || "No unit"
                                                }
                                                {" · "}
                                                {member.unit?.type
                                                    || "No unit type"
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {isEditingMember ? (
                                        <form
                                            className="organization-member-role-form"
                                            onSubmit={(e)=>
                                                handleUpdateMemberRole(
                                                    e,
                                                    member.id
                                                )
                                            }
                                        >
                                            <select
                                                value={editingRole}
                                                onChange={(e)=>
                                                    setEditingRole(
                                                        e.target.value
                                                    )
                                                }
                                                required
                                            >
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
                                                {updatingMemberRole
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
                                            onSubmit={(e)=>
                                                handleUpdateMemberUnit(
                                                    e,
                                                    member.id
                                                )
                                            }
                                        >
                                            <select
                                                value={destinationUnitId}
                                                onChange={(e)=>
                                                    setDestinationUnitId(
                                                        e.target.value
                                                    )
                                                }
                                                required
                                            >
                                                <option value="">
                                                    Select destination unit
                                                </option>

                                                {organizationUnits
                                                    .filter((unit)=>
                                                        unit.id !==
                                                        member.unitId
                                                    )
                                                    .map((unit)=>(
                                                        <option
                                                            key={unit.id}
                                                            value={unit.id}
                                                        >
                                                            {unit.name}
                                                            {" "}
                                                            ({unit.type})
                                                        </option>
                                                    ))
                                                }
                                            </select>

                                            <button
                                                type="submit"
                                                disabled={movingMember}
                                            >
                                                {movingMember
                                                    ? "Moving..."
                                                    : "Move"
                                                }
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    handleCancelMoveMember
                                                }
                                                disabled={movingMember}
                                            >
                                                Cancel
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="organization-member-actions">
                                            <div className="organization-member-role">
                                                <span>
                                                    {member.role}
                                                </span>

                                                {member.role !== "OWNER" && (
                                                    <button
                                                        type="button"
                                                        onClick={()=>
                                                            handleEditMemberRole(
                                                                member
                                                            )
                                                        }
                                                        disabled={
                                                            removingMemberId ===
                                                            member.id
                                                        }
                                                    >
                                                        Change Role
                                                    </button>
                                                )}
                                            </div>

                                            {member.role !== "OWNER" && (
                                                <>
                                                    <button
                                                        className="organization-member-move-button"
                                                        type="button"
                                                        onClick={()=>
                                                            handleMoveMember(
                                                                member
                                                            )
                                                        }
                                                        disabled={
                                                            removingMemberId ===
                                                            member.id
                                                        }
                                                    >
                                                        Move Member
                                                    </button>

                                                    <button
                                                        className="organization-member-remove-button"
                                                        type="button"
                                                        onClick={()=>
                                                            handleRemoveMember(
                                                                member
                                                            )
                                                        }
                                                        disabled={
                                                            removingMemberId ===
                                                            member.id
                                                        }
                                                    >
                                                        {removingMemberId ===
                                                        member.id
                                                            ? "Removing..."
                                                            : "Remove Member"
                                                        }
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}

export default Organization;