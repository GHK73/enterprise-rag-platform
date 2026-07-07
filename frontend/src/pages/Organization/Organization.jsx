// frontend/src/pages/Organization/Organization.jsx

import {useEffect,useState} from "react";
import api from "../../api/axios";
import "./Organization.css";

function Organization(){
    const [organization,setOrganization] = useState(null);
    const [organizationUnits,setOrganizationUnits] = useState([]);
    const [loading,setLoading] = useState(true);
    const [error,setError] = useState("");
    const [name,setName] = useState("");
    const [parentId,setParentId] = useState("");
    const [creating,setCreating] = useState(false);
    const [message,setMessage] = useState("");
    const [editingUnitId,setEditingUnitId] = useState(null);
    const [editingName,setEditingName] = useState("");
    const [updating,setUpdating] = useState(false);
    const [deletingUnitId,setDeletingUnitId] = useState(null);
    const [capacityData,setCapacityData] = useState({});
    const [loadingCapacityId,setLoadingCapacityId] = useState(null);
    const [editingCapacityId,setEditingCapacityId] = useState(null);
    const [allocatedCapacity,setAllocatedCapacity] = useState("");
    const [updatingCapacity,setUpdatingCapacity] = useState(false);

    useEffect(()=>{
        const fetchOrganizationData = async()=>{
            try{
                const [organizationResponse,unitsResponse] = await Promise.all([
                    api.get("/organization"),
                    api.get("/organization/units")
                ]);

                setOrganization(organizationResponse.data.data);
                setOrganizationUnits(unitsResponse.data.data);
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
            COMPANY: "DEPARTMENT",
            DEPARTMENT: "TEAM",
            TEAM: "GROUP"
        };

        return hierarchy[parentType];
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
                    parentId: parentUnit.id
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
                    name: editingName
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
                [unitId]: response.data.data
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
                    allocatedCapacity: Number(allocatedCapacity)
                }
            );
    
            const response = await api.get(
                `/organization/units/${unitId}/capacity`
            );
    
            setCapacityData((currentCapacity)=>({
                ...currentCapacity,
                [unitId]: response.data.data
            }));
    
            setEditingCapacityId(null);
            setAllocatedCapacity("");
            setMessage("Organization unit capacity updated successfully");
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
    const renderOrganizationUnit = (unit)=>{
        const childUnits = organizationUnits.filter(
            (childUnit)=>childUnit.parentId === unit.id
        );

        const isEditing = editingUnitId === unit.id;
        const unitCapacity = capacityData[unit.id];
        const isEditingCapacity = editingCapacityId === unit.id;

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
                                onSubmit={(e)=>handleUpdateUnit(e,unit.id)}
                            >
                                <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e)=>setEditingName(e.target.value)}
                                    required
                                    autoFocus
                                />

                                <button
                                    type="submit"
                                    disabled={updating}
                                >
                                    {updating ? "Saving..." : "Save"}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={updating}
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

                    {!isEditing && (
                        <div className="organization-unit-actions">
                            <button
                                className="organization-unit-capacity-button"
                                type="button"
                                onClick={()=>handleViewCapacity(unit.id)}
                                disabled={loadingCapacityId === unit.id}
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
                                        onClick={()=>handleEditUnit(unit)}
                                        disabled={deletingUnitId === unit.id}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        className="organization-unit-delete-button"
                                        type="button"
                                        onClick={()=>handleDeleteUnit(unit)}
                                        disabled={deletingUnitId === unit.id}
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
                                onSubmit={(e)=>handleUpdateCapacity(e,unit.id)}
                            >
                                <input
                                    type="number"
                                    min="1"
                                    value={allocatedCapacity}
                                    onChange={(e)=>setAllocatedCapacity(e.target.value)}
                                    placeholder="Enter capacity"
                                    required
                                />

                                <button
                                    type="submit"
                                    disabled={updatingCapacity}
                                >
                                    {updatingCapacity ? "Saving..." : "Save"}
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
                                        {unitCapacity.allocatedCapacity ?? "Not set"}
                                    </strong>
                                </div>

                                <div>
                                    <span>Direct Members</span>
                                    <strong>{unitCapacity.directMembers}</strong>
                                </div>

                                <div>
                                    <span>Child Allocations</span>
                                    <strong>{unitCapacity.childAllocations}</strong>
                                </div>

                                <div>
                                    <span>Remaining</span>
                                    <strong>
                                        {unitCapacity.remainingCapacity ?? "Not set"}
                                    </strong>
                                </div>

                                <button
                                    className="organization-capacity-edit-button"
                                    type="button"
                                    onClick={()=>handleEditCapacity(unit)}
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
                                View and manage departments, teams, and groups
                                within your organization.
                            </p>
                        </div>
                    </div>

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
                                onChange={(e)=>setParentId(e.target.value)}
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
                                onChange={(e)=>setName(e.target.value)}
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
            </div>
        </main>
    );
}

export default Organization;

