import {useEffect,useMemo,useState} from "react";
import api from "../../api/axios";
import "./Organization.css";

function Organization(){
    const [organization,setOrganization] = useState(null);
    const [organizationUnits,setOrganizationUnits] = useState([]);
    const [organizationMembers,setOrganizationMembers] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");
    const [message,setMessage] = useState("");

    const [selectedUnitId,setSelectedUnitId] = useState(null);
    const [expandedUnitIds,setExpandedUnitIds] = useState([]);
    const [memberSearch,setMemberSearch] = useState("");

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

    const [editingMemberId,setEditingMemberId] = useState(null);
    const [editingRole,setEditingRole] = useState("");
    const [updatingMemberRole,setUpdatingMemberRole] = useState(false);

    const [movingMemberId,setMovingMemberId] = useState(null);
    const [destinationUnitId,setDestinationUnitId] = useState("");
    const [movingMember,setMovingMember] = useState(false);

    const [removingMemberId,setRemovingMemberId] = useState(null);

    const [organizationRevision,setOrganizationRevision] = useState(null);
    const [latestOrganizationRevision,setLatestOrganizationRevision] = useState(null);
    const [checkingRevision,setCheckingRevision] = useState(false);
    const [refreshingOrganization,setRefreshingOrganization] = useState(false);

    useEffect(()=>{
        const fetchOrganizationData = async()=>{
            try{
                const [
                    organizationResponse,
                    unitsResponse,
                    membersResponse,
                    revisionResponse
                ] = await Promise.all([
                    api.get("/organization"),
                    api.get("/organization/units"),
                    api.get("/organization/members"),
                    api.get("/organization/revision")
                ]);

                const organizationData =
                    organizationResponse.data.data;

                const unitsData =
                    unitsResponse.data.data;

                const membersData =
                    membersResponse.data.data;

                const revisionData =
                    revisionResponse.data.data;

                setOrganization(organizationData);
                setOrganizationUnits(unitsData);
                setOrganizationMembers(membersData);

                setOrganizationRevision(
                    revisionData.revision
                );

                setLatestOrganizationRevision(
                    revisionData.revision
                );

                const rootUnit = unitsData.find(
                    (unit)=>unit.type === "COMPANY"
                );

                if(rootUnit){
                    setSelectedUnitId(rootUnit.id);
                    setExpandedUnitIds([rootUnit.id]);
                }
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

    const handleCheckRevision = async()=>{
        try{
            setCheckingRevision(true);
            setError("");

            const response = await api.get(
                "/organization/revision"
            );

            setLatestOrganizationRevision(
                response.data.data.revision
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to check organization updates"
            );
        }
        finally{
            setCheckingRevision(false);
        }
    };

    const syncOrganizationRevision = async()=>{
        const response = await api.get(
            "/organization/revision"
        );

        const revision =
            response.data.data.revision;

        setOrganizationRevision(revision);
        setLatestOrganizationRevision(revision);
    };

    useEffect(()=>{
        const checkForOrganizationUpdates = async()=>{
            if(document.visibilityState !== "visible"){
                return;
            }

            try{
                const response = await api.get(
                    "/organization/revision"
                );

                setLatestOrganizationRevision(
                    response.data.data.revision
                );
            }
            catch(error){
                console.error(
                    "Failed to check organization revision",
                    error
                );
            }
        };

        const handleVisibilityChange = ()=>{
            if(document.visibilityState === "visible"){
                checkForOrganizationUpdates();
            }
        };

        const intervalId = setInterval(
            checkForOrganizationUpdates,
            60000
        );

        document.addEventListener(
            "visibilitychange",
            handleVisibilityChange
        );

        return ()=>{
            clearInterval(intervalId);

            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    },[]);

    const handleRefreshOrganizationChanges = async()=>{
        if(refreshingOrganization){
            return;
        }
    
        try{
            setRefreshingOrganization(true);
            setError("");
            setMessage("");
    
            const beforeRevisionResponse = await api.get(
                "/organization/revision"
            );
    
            const beforeRevision =
                beforeRevisionResponse.data.data.revision;
    
            const [
                organizationResponse,
                unitsResponse,
                membersResponse
            ] = await Promise.all([
                api.get("/organization"),
                api.get("/organization/units"),
                api.get("/organization/members")
            ]);
    
            const afterRevisionResponse = await api.get(
                "/organization/revision"
            );
    
            const afterRevision =
                afterRevisionResponse.data.data.revision;
    
            if(beforeRevision !== afterRevision){
                setLatestOrganizationRevision(
                    afterRevision
                );
    
                setError(
                    "Organization changed while refreshing. Please refresh changes again."
                );
    
                return;
            }
    
            const organizationData =
                organizationResponse.data.data;
    
            const unitsData =
                unitsResponse.data.data;
    
            const membersData =
                membersResponse.data.data;
    
            setOrganization(organizationData);
            setOrganizationUnits(unitsData);
            setOrganizationMembers(membersData);
    
            setOrganizationRevision(afterRevision);
            setLatestOrganizationRevision(afterRevision);
    
            const selectedUnitStillExists =
                unitsData.some(
                    (unit)=>unit.id === selectedUnitId
                );
    
            if(!selectedUnitStillExists){
                const rootUnit = unitsData.find(
                    (unit)=>unit.type === "COMPANY"
                );
    
                setSelectedUnitId(
                    rootUnit?.id || null
                );
            }
    
            setCapacityData({});
    
            setMessage(
                "Organization changes refreshed successfully"
            );
        }
        catch(error){
            setError(
                error.response?.data?.message ||
                "Failed to refresh organization changes"
            );
        }
        finally{
            setRefreshingOrganization(false);
        }
    };

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

    const unitsByParent = useMemo(()=>{
        const unitMap = {};

        organizationUnits.forEach((unit)=>{
            const key = unit.parentId || "ROOT";

            if(!unitMap[key]){
                unitMap[key] = [];
            }

            unitMap[key].push(unit);
        });

        return unitMap;
    },[organizationUnits]);

    const rootUnit = useMemo(
        ()=>organizationUnits.find(
            (unit)=>unit.type === "COMPANY"
        ),
        [organizationUnits]
    );

    const selectedUnit = useMemo(
        ()=>organizationUnits.find(
            (unit)=>unit.id === selectedUnitId
        ),
        [organizationUnits,selectedUnitId]
    );

    const selectedUnitMembers = useMemo(
        ()=>organizationMembers.filter(
            (member)=>member.unitId === selectedUnitId
        ),
        [organizationMembers,selectedUnitId]
    );

    const filteredSelectedUnitMembers = useMemo(()=>{
        const searchValue = memberSearch
            .trim()
            .toLowerCase();

        if(!searchValue){
            return selectedUnitMembers;
        }

        return selectedUnitMembers.filter((member)=>
            member.fullName
                .toLowerCase()
                .includes(searchValue) ||
            member.email
                .toLowerCase()
                .includes(searchValue)
        );
    },[selectedUnitMembers,memberSearch]);

    const availableParentUnits = useMemo(
        ()=>organizationUnits.filter(
            (unit)=>unit.type !== "GROUP"
        ),
        [organizationUnits]
    );

    const selectedParentUnit = organizationUnits.find(
        (unit)=>unit.id === parentId
    );

    const childType = selectedParentUnit
        ? getChildType(selectedParentUnit.type)
        : null;

    const handleToggleUnit = (unitId)=>{
        setExpandedUnitIds((currentIds)=>
            currentIds.includes(unitId)
                ? currentIds.filter((id)=>id !== unitId)
                : [...currentIds,unitId]
        );
    };

    const handleSelectUnit = (unit)=>{
        setSelectedUnitId(unit.id);
        setMemberSearch("");

        setEditingUnitId(null);
        setEditingName("");

        setMovingUnitId(null);
        setDestinationParentId("");

        setEditingCapacityId(null);
        setAllocatedCapacity("");

        setEditingMemberId(null);
        setEditingRole("");

        setMovingMemberId(null);
        setDestinationUnitId("");

        setError("");
        setMessage("");
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

            const createdUnit = response.data.data;

            setOrganizationUnits((currentUnits)=>[
                ...currentUnits,
                createdUnit
            ]);

            setExpandedUnitIds((currentIds)=>
                currentIds.includes(parentUnit.id)
                    ? currentIds
                    : [...currentIds,parentUnit.id]
            );

            setSelectedUnitId(createdUnit.id);
            setMemberSearch("");
            setName("");
            setParentId("");

            await syncOrganizationRevision();

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

            await syncOrganizationRevision();

            setMessage(
                "Organization unit updated successfully"
            );
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

            setExpandedUnitIds((currentIds)=>
                currentIds.includes(destinationParentId)
                    ? currentIds
                    : [...currentIds,destinationParentId]
            );

            setMovingUnitId(null);
            setDestinationParentId("");
            setCapacityData({});

            await syncOrganizationRevision();

            setMessage(
                "Organization unit moved successfully"
            );
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
                    (currentUnit)=>
                        currentUnit.id !== unit.id
                )
            );

            setExpandedUnitIds((currentIds)=>
                currentIds.filter(
                    (id)=>id !== unit.id
                )
            );

            setCapacityData((currentCapacity)=>{
                const updatedCapacity = {
                    ...currentCapacity
                };

                delete updatedCapacity[unit.id];

                return updatedCapacity;
            });

            setSelectedUnitId(
                unit.parentId || rootUnit?.id || null
            );

            setMemberSearch("");

            await syncOrganizationRevision();

            setMessage(
                "Organization unit deleted successfully"
            );
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
        if(capacityData[unitId]){
            return;
        }

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

    const handleCancelCapacity = ()=>{
        setEditingCapacityId(null);
        setAllocatedCapacity("");
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
                    allocatedCapacity:
                        Number(allocatedCapacity)
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

            await syncOrganizationRevision();

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

            await syncOrganizationRevision();

            setMessage(
                "Member role updated successfully"
            );
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

            await syncOrganizationRevision();

            setMessage(
                "Member moved successfully"
            );
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

            await syncOrganizationRevision();

            setMessage(
                "Member removed successfully"
            );
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

    const renderOrganizationUnit = (unit,depth=0)=>{
        const childUnits =
            unitsByParent[unit.id] || [];

        const hasChildren =
            childUnits.length > 0;

        const isExpanded =
            expandedUnitIds.includes(unit.id);

        const isSelected =
            selectedUnitId === unit.id;

        return (
            <div
                className="organization-tree-branch"
                key={unit.id}
            >
                <div
                    className={
                        `organization-tree-row ${
                            isSelected
                                ? "organization-tree-row-selected"
                                : ""
                        }`
                    }
                    style={{
                        "--organization-tree-depth":depth
                    }}
                >
                    <button
                        className="organization-tree-toggle"
                        type="button"
                        onClick={()=>
                            hasChildren &&
                            handleToggleUnit(unit.id)
                        }
                        disabled={!hasChildren}
                        aria-label={
                            isExpanded
                                ? "Collapse unit"
                                : "Expand unit"
                        }
                    >
                        {hasChildren
                            ? isExpanded
                                ? "−"
                                : "+"
                            : "·"
                        }
                    </button>

                    <button
                        className="organization-tree-select"
                        type="button"
                        onClick={()=>
                            handleSelectUnit(unit)
                        }
                    >
                        <span className="organization-tree-icon">
                            {unit.name
                                .charAt(0)
                                .toUpperCase()
                            }
                        </span>

                        <span className="organization-tree-content">
                            <strong>
                                {unit.name}
                            </strong>

                            <small>
                                {unit.type}
                            </small>
                        </span>
                    </button>

                    <span className="organization-tree-count">
                        {childUnits.length}
                    </span>
                </div>

                {hasChildren && isExpanded && (
                    <div className="organization-tree-children">
                        {childUnits.map((childUnit)=>
                            renderOrganizationUnit(
                                childUnit,
                                depth + 1
                            )
                        )}
                    </div>
                )}
            </div>
        );
    };

    const selectedUnitCapacity =
        selectedUnit
            ? capacityData[selectedUnit.id]
            : null;

    const validParentType =
        selectedUnit
            ? getValidParentType(selectedUnit.type)
            : null;

    const validDestinationUnits =
        selectedUnit
            ? organizationUnits.filter(
                (destinationUnit)=>
                    destinationUnit.type ===
                        validParentType &&
                    destinationUnit.id !==
                        selectedUnit.parentId
            )
            : [];

    const hasOrganizationUpdates =
        organizationRevision !== null &&
        latestOrganizationRevision !== null &&
        latestOrganizationRevision >
            organizationRevision;

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
        <main className="organization-page app-page-background">
            <div className="organization-container">
                <header className="organization-header">
                    <p className="organization-eyebrow">
                        Organization Management
                    </p>

                    <h1>{organization.name}</h1>

                    <p className="organization-description">
                        {organization.description ||
                            "No description"
                        }
                    </p>
                </header>

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

                <section className="organization-section">
                    <div className="organization-section-header">
                        <div>
                            <h2>
                                Organization Structure
                            </h2>

                            <p>
                                Browse the hierarchy and select
                                a unit to manage it.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="organization-check-updates-button"
                            onClick={handleCheckRevision}
                            disabled={checkingRevision}
                        >
                            {checkingRevision
                                ? "Checking..."
                                : "Check Updates"
                            }
                        </button>
                    </div>

                    {hasOrganizationUpdates && (
                        <div className="organization-updates-available">
                            <div>
                                <strong>
                                    Organization updates available
                                </strong>

                                <p>
                                    Another user has changed the
                                    organization since this page
                                    was loaded.
                                </p>
                            </div>

                            <div className="organization-updates-actions">
                                <span>
                                    Revision {organizationRevision}
                                    {" → "}
                                    {latestOrganizationRevision}
                                </span>

                                <button
                                    type="button"
                                    onClick={handleRefreshOrganizationChanges}
                                    disabled={refreshingOrganization}
                                >
                                    {refreshingOrganization
                                        ? "Refreshing..."
                                        : "Refresh Changes"
                                    }
                                </button>
                            </div>
                        </div>
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

                                {availableParentUnits.map(
                                    (unit)=>(
                                        <option
                                            key={unit.id}
                                            value={unit.id}
                                        >
                                            {unit.name}
                                            {" "}
                                            ({unit.type})
                                        </option>
                                    )
                                )}
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
                            disabled={
                                creating || !childType
                            }
                        >
                            {creating
                                ? "Creating..."
                                : childType
                                    ? `Add ${childType}`
                                    : "Select Parent"
                            }
                        </button>
                    </form>

                    <div className="organization-workspace">
                        <div className="organization-tree-panel">
                            <div className="organization-panel-heading">
                                <div>
                                    <h3>Hierarchy</h3>

                                    <p>
                                        {organizationUnits.length}
                                        {" "}
                                        units
                                    </p>
                                </div>
                            </div>

                            <div className="organization-tree">
                                {rootUnit
                                    ? renderOrganizationUnit(
                                        rootUnit
                                    )
                                    : (
                                        <p className="organization-form-error">
                                            Company unit not found
                                        </p>
                                    )
                                }
                            </div>
                        </div>

                        <div className="organization-details-panel">
                            {selectedUnit ? (
                                <>
                                    <div className="organization-selected-header">
                                        <div className="organization-selected-icon">
                                            {selectedUnit.name
                                                .charAt(0)
                                                .toUpperCase()
                                            }
                                        </div>

                                        <div>
                                            <span>
                                                {selectedUnit.type}
                                            </span>

                                            <h3>
                                                {selectedUnit.name}
                                            </h3>

                                            <p>
                                                {
                                                    selectedUnitMembers.length
                                                }
                                                {" "}
                                                direct members
                                            </p>
                                        </div>
                                    </div>

                                    {editingUnitId ===
                                    selectedUnit.id ? (
                                        <form
                                            className="organization-unit-edit-form"
                                            onSubmit={(e)=>
                                                handleUpdateUnit(
                                                    e,
                                                    selectedUnit.id
                                                )
                                            }
                                        >
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e)=>
                                                    setEditingName(
                                                        e.target.value
                                                    )
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
                                                onClick={
                                                    handleCancelEdit
                                                }
                                                disabled={updating}
                                            >
                                                Cancel
                                            </button>
                                        </form>
                                    ) : movingUnitId ===
                                    selectedUnit.id ? (
                                        <form
                                            className="organization-unit-move-form"
                                            onSubmit={(e)=>
                                                handleUpdateUnitParent(
                                                    e,
                                                    selectedUnit.id
                                                )
                                            }
                                        >
                                            <select
                                                value={
                                                    destinationParentId
                                                }
                                                onChange={(e)=>
                                                    setDestinationParentId(
                                                        e.target.value
                                                    )
                                                }
                                                required
                                            >
                                                <option value="">
                                                    Select new parent
                                                </option>

                                                {validDestinationUnits.map(
                                                    (destinationUnit)=>(
                                                        <option
                                                            key={
                                                                destinationUnit.id
                                                            }
                                                            value={
                                                                destinationUnit.id
                                                            }
                                                        >
                                                            {
                                                                destinationUnit.name
                                                            }
                                                            {" "}
                                                            (
                                                            {
                                                                destinationUnit.type
                                                            }
                                                            )
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
                                                onClick={
                                                    handleCancelMoveUnit
                                                }
                                                disabled={movingUnit}
                                            >
                                                Cancel
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="organization-selected-actions">
                                            <button
                                                type="button"
                                                onClick={()=>
                                                    handleViewCapacity(
                                                        selectedUnit.id
                                                    )
                                                }
                                                disabled={
                                                    loadingCapacityId ===
                                                    selectedUnit.id
                                                }
                                            >
                                                {loadingCapacityId ===
                                                selectedUnit.id
                                                    ? "Loading..."
                                                    : "Capacity"
                                                }
                                            </button>

                                            {selectedUnit.type !==
                                            "COMPANY" && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={()=>
                                                            handleEditUnit(
                                                                selectedUnit
                                                            )
                                                        }
                                                    >
                                                        Rename
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={()=>
                                                            handleMoveUnit(
                                                                selectedUnit
                                                            )
                                                        }
                                                    >
                                                        Move
                                                    </button>

                                                    <button
                                                        className="organization-danger-button"
                                                        type="button"
                                                        onClick={()=>
                                                            handleDeleteUnit(
                                                                selectedUnit
                                                            )
                                                        }
                                                        disabled={
                                                            deletingUnitId ===
                                                            selectedUnit.id
                                                        }
                                                    >
                                                        {deletingUnitId ===
                                                        selectedUnit.id
                                                            ? "Deleting..."
                                                            : "Delete"
                                                        }
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {selectedUnitCapacity && (
                                        <div className="organization-capacity-panel">
                                            <div className="organization-capacity-header">
                                                <h4>
                                                    Capacity
                                                </h4>

                                                {editingCapacityId !==
                                                selectedUnit.id && (
                                                    <button
                                                        type="button"
                                                        onClick={()=>
                                                            handleEditCapacity(
                                                                selectedUnit
                                                            )
                                                        }
                                                    >
                                                        Set / Update
                                                    </button>
                                                )}
                                            </div>

                                            {editingCapacityId ===
                                            selectedUnit.id ? (
                                                <form
                                                    className="organization-capacity-form"
                                                    onSubmit={(e)=>
                                                        handleUpdateCapacity(
                                                            e,
                                                            selectedUnit.id
                                                        )
                                                    }
                                                >
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={
                                                            allocatedCapacity
                                                        }
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
                                                        disabled={
                                                            updatingCapacity
                                                        }
                                                    >
                                                        {updatingCapacity
                                                            ? "Saving..."
                                                            : "Save"
                                                        }
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={
                                                            handleCancelCapacity
                                                        }
                                                        disabled={
                                                            updatingCapacity
                                                        }
                                                    >
                                                        Cancel
                                                    </button>
                                                </form>
                                            ) : (
                                                <div className="organization-capacity-grid">
                                                    <div>
                                                        <span>
                                                            Allocated
                                                        </span>

                                                        <strong>
                                                            {
                                                                selectedUnitCapacity
                                                                    .allocatedCapacity
                                                                ?? "Not set"
                                                            }
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Direct Members
                                                        </span>

                                                        <strong>
                                                            {
                                                                selectedUnitCapacity
                                                                    .directMembers
                                                            }
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Child Allocations
                                                        </span>

                                                        <strong>
                                                            {
                                                                selectedUnitCapacity
                                                                    .childAllocations
                                                            }
                                                        </strong>
                                                    </div>

                                                    <div>
                                                        <span>
                                                            Remaining
                                                        </span>

                                                        <strong>
                                                            {
                                                                selectedUnitCapacity
                                                                    .remainingCapacity
                                                                ?? "Not set"
                                                            }
                                                        </strong>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="organization-unit-summary">
                                        <div>
                                            <span>
                                                Child Units
                                            </span>

                                            <strong>
                                                {
                                                    (
                                                        unitsByParent[
                                                            selectedUnit.id
                                                        ] || []
                                                    ).length
                                                }
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Direct Members
                                            </span>

                                            <strong>
                                                {
                                                    selectedUnitMembers.length
                                                }
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="organization-unit-members">
                                        <div className="organization-unit-members-header">
                                            <div>
                                                <h4>
                                                    Direct Members
                                                </h4>

                                                <p>
                                                    Manage members assigned
                                                    directly to this unit.
                                                </p>
                                            </div>

                                            <span>
                                                {
                                                    selectedUnitMembers.length
                                                }
                                            </span>
                                        </div>

                                        {selectedUnitMembers.length > 0 && (
                                            <div className="organization-member-search">
                                                <input
                                                    type="text"
                                                    placeholder="Search members by name or email"
                                                    value={memberSearch}
                                                    onChange={(e)=>
                                                        setMemberSearch(
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}

                                        <div className="organization-members">
                                            {filteredSelectedUnitMembers.length >
                                            0 ? (
                                                filteredSelectedUnitMembers.map(
                                                    (member)=>{
                                                        const isEditingMember =
                                                            editingMemberId ===
                                                            member.id;

                                                        const isMovingMember =
                                                            movingMemberId ===
                                                            member.id;

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
                                                                            value={
                                                                                editingRole
                                                                            }
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
                                                                            value={
                                                                                destinationUnitId
                                                                            }
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
                                                                                .filter(
                                                                                    (unit)=>
                                                                                        unit.id !==
                                                                                        member.unitId
                                                                                )
                                                                                .map(
                                                                                    (unit)=>(
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
                                                                            disabled={
                                                                                movingMember
                                                                            }
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </form>
                                                                ) : (
                                                                    <div className="organization-member-actions">
                                                                        <span className="organization-member-role-badge">
                                                                            {
                                                                                member.role
                                                                            }
                                                                        </span>

                                                                        {member.role !==
                                                                        "OWNER" && (
                                                                            <>
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
                                                                                    Role
                                                                                </button>

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
                                                                                    Move
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
                                                                                        : "Remove"
                                                                                    }
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </article>
                                                        );
                                                    }
                                                )
                                            ) : (
                                                <div className="organization-members-empty">
                                                    <h4>
                                                        {memberSearch
                                                            ? "No members found"
                                                            : "No direct members"
                                                        }
                                                    </h4>

                                                    <p>
                                                        {memberSearch
                                                            ? "No member matches your search."
                                                            : "No members are directly assigned to this unit."
                                                        }
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="organization-empty-panel">
                                    <h3>
                                        Select a unit
                                    </h3>

                                    <p>
                                        Choose a unit from the hierarchy
                                        to manage it.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default Organization;