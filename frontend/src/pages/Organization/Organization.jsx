import { useEffect } from "react";

import "./Organization.css";

import useOrganizationData from "./hooks/useOrganizationData";
import useOrganizationTree from "./hooks/useOrganizationTree";
import useOrganizationRevision from "./hooks/useOrganizationRevision";
import useOrganizationCapacity from "./hooks/useOrganizationCapacity";
import useOrganizationUnits from "./hooks/useOrganizationUnits";
import useOrganizationMembers from "./hooks/useOrganizationMembers";

import OrganizationHeader from "./components/OrganizationHeader";
import OrganizationCreateForm from "./components/OrganizationCreateForm";
import OrganizationTree from "./components/OrganizationTree";
import OrganizationDetails from "./components/OrganizationDetails";
import CapacityPanel from "./components/CapacityPanel";
import MembersPanel from "./components/MembersPanel";
import UpdateNotification from "./components/UpdateNotification";


const Organization = () => {


    const {

        organization,

        organizationUnits,

        organizationMembers,

        loading,

        error,

        message,

        setError,

        setMessage,

        refreshOrganization,

    } = useOrganizationData();



    const {
        rootUnit,
    
        selectedUnit,
    
        selectedUnitId,
    
        setSelectedUnitId,
    
        unitsByParent,
    
        expandedUnitIds,
    
        setExpandedUnitIds,
    
        handleToggleUnit,
    
        handleSelectUnit,
    
    } = useOrganizationTree(
        organizationUnits
    );

    const capacity =
        useOrganizationCapacity({

            setError,

            setMessage,

            onSuccess:
                refreshOrganization,

        });



    const revision =
        useOrganizationRevision({

            refreshOrganization,

            onRefresh:
                capacity.clearCapacityCache,

            setError,

            setMessage,

        });
        console.log({
            organizationRevision:
                revision.organizationRevision,
        
            latestOrganizationRevision:
                revision.latestOrganizationRevision,
        
            hasOrganizationUpdates:
                revision.hasOrganizationUpdates,
        });



    const units =
        useOrganizationUnits({

            organizationUnits,

            selectedUnit,

            setOrganizationUnits:
                () => {},

            rootUnit,

            setSelectedUnitId,

            setExpandedUnitIds,

            setCapacityData:
                capacity.setCapacityData,

            onSuccess:
                revision.syncOrganizationRevision,

            setError,

            setMessage,

        });



    const members =
        useOrganizationMembers({

            organizationMembers,

            setOrganizationMembers:
                () => {},

            selectedUnit,

            onSuccess:
                revision.syncOrganizationRevision,

            setError,

            setMessage,

        });



    useEffect(() => {

        if (
            !selectedUnit
        ) {
            return;
        }


        capacity.handleViewCapacity(
            selectedUnit.id
        );


    }, [
        selectedUnit,
    ]);



    const handleSelectOrganizationUnit =
        (
            unit
        ) => {


            handleSelectUnit(
                unit
            );


            units.resetUnitEditor();


            units.resetMoveEditor();


            members.resetMemberEditor();


            capacity.resetCapacityEditor();

        };



    if (
        loading
    ) {

        return (

            <div className="organization-loading">

                Loading organization...

            </div>

        );

    }



    if (
        !organization
    ) {

        return (

            <OrganizationCreateForm

                name={
                    units.name
                }

                setName={
                    units.setName
                }

                parentId={
                    units.parentId
                }

                setParentId={
                    units.setParentId
                }

                creating={
                    units.creating
                }

                availableParentUnits={
                    units.availableParentUnits
                }

                childType={
                    units.childType
                }

                handleCreateUnit={
                    units.handleCreateUnit
                }

                error={
                    error
                }

                message={
                    message
                }

            />

        );

    }
    return (

        <div
            className="organization-page"
        >

            <OrganizationHeader

                organization={
                    organization
                }

                revision={
                    revision.organizationRevision
                }

                latestRevision={
                    revision.latestOrganizationRevision
                }

                checkingRevision={
                    revision.checkingRevision
                }

                handleCheckRevision={
                    revision.handleCheckRevision
                }

            />


            <UpdateNotification

            hasOrganizationUpdates={
                revision.hasOrganizationUpdates
            }

            organizationRevision={
                revision.organizationRevision
            }

            latestOrganizationRevision={
                revision.latestOrganizationRevision
            }

            refreshingOrganization={
                revision.refreshingOrganization
            }

            handleRefreshOrganizationChanges={
                revision.handleRefreshOrganizationChanges
            }

            />


            {
                error && (

                    <div
                        className="organization-error"
                    >
                        {error}
                    </div>

                )
            }


            {
                message && (

                    <div
                        className="organization-message"
                    >
                        {message}
                    </div>

                )
            }



            <div
                className="organization-layout"
            >


                <OrganizationTree

                    rootUnit={
                        rootUnit
                    }

                    unitsByParent={
                        unitsByParent
                    }

                    selectedUnitId={
                        selectedUnitId
                    }

                    expandedUnitIds={
                        expandedUnitIds
                    }

                    handleToggleUnit={
                        handleToggleUnit
                    }

                    handleSelectUnit={
                        handleSelectOrganizationUnit
                    }

                />



                <div
                    className="organization-content"
                >


                    <OrganizationDetails

                        selectedUnit={
                            selectedUnit
                        }

                        selectedUnitMembers={
                            members.selectedUnitMembers
                        }
                    
                        unitsByParent={
                            unitsByParent
                        }
                    
                        loadingCapacityId={
                            capacity.loadingCapacityId
                        }
                    
                        handleViewCapacity={
                            capacity.handleViewCapacity
                        }

                        name={
                            units.name
                        }

                        setName={
                            units.setName
                        }

                        editingUnitId={
                            units.editingUnitId
                        }

                        editingName={
                            units.editingName
                        }

                        setEditingName={
                            units.setEditingName
                        }

                        updating={
                            units.updating
                        }

                        deletingUnitId={
                            units.deletingUnitId
                        }

                        movingUnitId={
                            units.movingUnitId
                        }

                        destinationParentId={
                            units.destinationParentId
                        }

                        setDestinationParentId={
                            units.setDestinationParentId
                        }

                        movingUnit={
                            units.movingUnit
                        }

                        validDestinationUnits={
                            units.validDestinationUnits
                        }

                        handleCreateUnit={
                            units.handleCreateUnit
                        }

                        handleEditUnit={
                            units.handleEditUnit
                        }

                        handleCancelEdit={
                            units.handleCancelEdit
                        }

                        handleUpdateUnit={
                            units.handleUpdateUnit
                        }

                        handleDeleteUnit={
                            units.handleDeleteUnit
                        }

                        handleMoveUnit={
                            units.handleMoveUnit
                        }

                        handleCancelMoveUnit={
                            units.handleCancelMoveUnit
                        }

                        handleUpdateUnitParent={
                            units.handleUpdateUnitParent
                        }

                    />



                    {
                        selectedUnit && (

                            <CapacityPanel

                                selectedUnit={
                                    selectedUnit
                                }

                                selectedUnitCapacity={
                                    capacity.capacityData[
                                        selectedUnit.id
                                    ]
                                }

                                editingCapacityId={
                                    capacity.editingCapacityId
                                }

                                allocatedCapacity={
                                    capacity.allocatedCapacity
                                }

                                setAllocatedCapacity={
                                    capacity.setAllocatedCapacity
                                }

                                updatingCapacity={
                                    capacity.updatingCapacity
                                }

                                handleEditCapacity={
                                    capacity.handleEditCapacity
                                }

                                handleUpdateCapacity={
                                    capacity.handleUpdateCapacity
                                }

                                handleCancelCapacity={
                                    capacity.handleCancelCapacity
                                }

                            />

                        )
                    }



                    {
                        selectedUnit && (

                            <MembersPanel

                                selectedUnit={
                                    selectedUnit
                                }

                                filteredSelectedUnitMembers={
                                    members.filteredSelectedUnitMembers
                                }

                                memberSearch={
                                    members.memberSearch
                                }

                                setMemberSearch={
                                    members.setMemberSearch
                                }

                                editingMemberId={
                                    members.editingMemberId
                                }

                                editingRole={
                                    members.editingRole
                                }

                                setEditingRole={
                                    members.setEditingRole
                                }

                                updatingMemberRole={
                                    members.updatingMemberRole
                                }

                                movingMemberId={
                                    members.movingMemberId
                                }

                                destinationUnitId={
                                    members.destinationUnitId
                                }

                                setDestinationUnitId={
                                    members.setDestinationUnitId
                                }

                                movingMember={
                                    members.movingMember
                                }

                                removingMemberId={
                                    members.removingMemberId
                                }

                                organizationUnits={
                                    organizationUnits
                                }

                                handleEditMemberRole={
                                    members.handleEditMemberRole
                                }

                                handleCancelMemberRole={
                                    members.handleCancelMemberRole
                                }

                                handleUpdateMemberRole={
                                    members.handleUpdateMemberRole
                                }

                                handleMoveMember={
                                    members.handleMoveMember
                                }

                                handleCancelMoveMember={
                                    members.handleCancelMoveMember
                                }

                                handleUpdateMemberUnit={
                                    members.handleUpdateMemberUnit
                                }

                                handleRemoveMember={
                                    members.handleRemoveMember
                                }

                            />

                        )
                    }


                </div>


            </div>


        </div>

    );

};


export default Organization;