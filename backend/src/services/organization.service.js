// backend/src/services/organization.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {
    hasPermission,
    isUnitInsideScope
} from "./permission.service.js";

export const createOrganization = async(userId, organizationData)=>{
    const {name, description, allocatedCapacity} = organizationData;

    if(
        allocatedCapacity !== undefined &&
        (
            !Number.isInteger(allocatedCapacity) ||
            allocatedCapacity <= 0
        )
    ){
        throw new ApiError(
            400,
            "Organization capacity must be a positive integer"
        );
    }

    const user = await prisma.user.findUnique({
        where:{
            id: userId
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(user.unitId){
        throw new ApiError(
            400,
            "User already belongs to an organization"
        );
    }

    const result = await prisma.$transaction(async(tx)=>{
        const organization = await tx.organization.create({
            data:{
                name,
                description
            }
        });

        const rootUnit = await tx.organizationUnit.create({
            data:{
                name,
                type: "COMPANY",
                organizationId: organization.id,
                allocatedCapacity
            }
        });

        await tx.user.update({
            where:{
                id: userId
            },
            data:{
                role: "OWNER",
                unitId: rootUnit.id
            }
        });

        const permissions = [
            "INVITE_MEMBER",
            "REMOVE_MEMBER",
            "UPDATE_MEMBER",
            "ASSIGN_ROLE",
            "MOVE_MEMBER",
            "CREATE_UNIT",
            "UPDATE_UNIT",
            "DELETE_UNIT",
            "MOVE_UNIT"
        ];

        await tx.permissionGrant.createMany({
            data: permissions.map((permission)=>({
                permission,
                organizationId: organization.id,
                userId,
                scopeUnitId: rootUnit.id,
                grantedById: userId,
                canDelegate: true
            }))
        });

        return organization;
    });

    return result;
};

export const getOrganization = async(userId)=>{
    const user = await prisma.user.findUnique({
        where:{
            id:userId 
        },
        include:{
            unit:{
                include:{
                    organization: true 
                }
            }
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an Organization"
        );
    }
    return user.unit.organization;
};

export const updateOrganization = async(userId, organizationData)=>{
    const {name, description} = organizationData;
    const user = await prisma.user.findUnique({
        where:{
            id:userId 
        },
        include:{
            unit:true 
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }
    if(user.role !== "OWNER" && user.role !== "ADMIN"){
        throw new ApiError(
            403,
            "You do not have permission to update this organization"
        );
    }
    const organization = await prisma.organization.update({
        where:{
            id: user.unit.organizationId 
        },
        data:{
            name,
            description 
        }
    });
    return organization;
};

export const createOrganizationUnit = async(userId, unitData)=>{
    const {name, type, parentId} = unitData;

    const user = await prisma.user.findUnique({
        where:{
            id: userId
        },
        include:{
            unit: true
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    if(type === "COMPANY"){
        throw new ApiError(
            400,
            "COMPANY organization unit already exists"
        );
    }

    const parentUnit = await prisma.organizationUnit.findUnique({
        where:{
            id: parentId
        }
    });

    if(!parentUnit){
        throw new ApiError(
            404,
            "Parent organization unit not Found"
        );
    }

    if(parentUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(
            403,
            "Parent unit does not belong to your organization"
        );
    }

    const canCreateUnit = await hasPermission(
        userId,
        "CREATE_UNIT",
        parentId
    );

    if(!canCreateUnit){
        throw new ApiError(
            403,
            "You do not have permission to create organization units in this scope"
        );
    }

    const validHierarchy = {
        COMPANY: "DEPARTMENT",
        DEPARTMENT: "TEAM",
        TEAM: "GROUP"
    };

    if(validHierarchy[parentUnit.type] !== type){
        throw new ApiError(
            400,
            `${type} cannot be created under ${parentUnit.type}`
        );
    }

    const organizationUnit = await prisma.organizationUnit.create({
        data:{
            name,
            type,
            organizationId: user.unit.organizationId,
            parentId
        }
    });

    return organizationUnit;
};

export const getOrganizationUnits = async(userId) =>{
    const user = await prisma.user.findUnique({
        where:{
            id:userId 
        },
        include:{
            unit:true 
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }
    const organizationUnits = await prisma.organizationUnit.findMany({
        where:{
            organizationId: user.unit.organizationId 
        },
        orderBy:{
            createdAt: "asc"
        }
    });
    return organizationUnits;
}

export const updateOrganizationUnit = async(
    userId,
    unitId,
    unitData 
)=>{
    const {name} = unitData;
    const user = await prisma.user.findUnique({
        where:{
            id:userId 
        },
        include:{
            unit: true 
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }
    if(user.role !== "OWNER" && user.role !== "ADMIN"){
        throw new ApiError(
            403,
            "You do not have permission to update organization units"
        );
    }
    const organizationUnit = await prisma.organizationUnit.findUnique({
        where:{
            id:unitId 
        }
    });
    if(!organizationUnit){
        throw new ApiError(
            404,
            "Organization unit not Found"
        );
    }
    if(organizationUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(
            403,
            "Organization unit does not belong to your organization"
        );
    }
    const updatedOrganizationUnit = await prisma.organizationUnit.update({
        where:{
            id:unitId 
        },
        data:{
            name 
        }
    });
    return updatedOrganizationUnit;
}

export const deleteOrganizationUnit = async(userId,unitId)=>{
    const user = await prisma.user.findUnique({
        where:{
            id:userId 
        },
        include:{
            unit: true 
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }
    if(user.role !== "OWNER" && user.role !== "ADMIN"){
        throw new ApiError(
            403,
            "You do not have permission to delete organization units"
        );
    }
    const organizationUnit = await prisma.organizationUnit.findUnique({
        where:{
            id:unitId 
        },
        include:{
            children: true,
            users: true 
        }
    });
    if(!organizationUnit){
        throw new ApiError(
            404,
            "Organization unit not Found"
        );
    }
    if(organizationUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(
            403,
            "Organization unit does not belong to your organization"
        );
    }
    if(organizationUnit.type === "COMPANY"){
        throw new ApiError(
            400,
            "COMPANY organization unit cannot be deleted"
        );
    }
    if(organizationUnit.children.length > 0){
        throw new ApiError(
            400,
            "Organization unit with child units cannot be deleted"
        );
    }
    await prisma.organizationUnit.delete({
        where:{
            id:unitId 
        }
    });
    return organizationUnit;
}

export const getOrganizationMembers = async(userId)=>{
    const user = await prisma.user.findUnique({
        where:{
            id: userId
        },
        include:{
            unit: true
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    const organizationMembers = await prisma.user.findMany({
        where:{
            unit:{
                organizationId: user.unit.organizationId
            }
        },
        select:{
            id: true,
            fullName: true,
            email: true,
            role: true,
            unitId: true,
            unit:{
                select:{
                    id: true,
                    name: true,
                    type: true
                }
            }
        },
        orderBy:{
            fullName: "asc"
        }
    });

    return organizationMembers;
};

export const getUnitCapacity = async(userId,unitId)=>{
    const user = await prisma.user.findUnique({
        where:{
            id:userId 
        },
        include:{
            unit:true 
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(404, "User does not belong to an organization");
    }
    const organizationUnit = await prisma.organizationUnit.findUnique({
        where:{id:unitId},
        include:{
            _count:{
                select:{users:true}
            },
            children:{
                select:{allocatedCapacity: true}
            }
        }
    });
    if(!organizationUnit){
        throw new ApiError(404,"Organization unit not Found");
    }
    if(organizationUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Organization unit does not belong to your organization");
    }
    const directMembers = organizationUnit._count.users;
    const childAllocations = organizationUnit.children.reduce(
        (total,child)=>{
            return total+(child.allocatedCapacity || 0);
        },
        0  
    );
    const allocatedCapacity = organizationUnit.allocatedCapacity;
    const remainingCapacity = allocatedCapacity === null? null: allocatedCapacity-directMembers-childAllocations;
    return {
        unitId: organizationUnit.id,
        unitName: organizationUnit.name,
        unitType: organizationUnit.type,
        allocatedCapacity,
        directMembers,
        childAllocations,
        remainingCapacity 
    };
};

export const updateUnitCapacity = async(userId, unitId, capacityData)=>{
    const {allocatedCapacity} = capacityData;
    if(!Number.isInteger(allocatedCapacity) || allocatedCapacity <=0){
        throw new ApiError(400,"Allocated capacity must be a positive integer");
    }
    const user = await prisma.user.findUnique({
        where:{id:userId},
        include:{unit:true}
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(404,"User does not belong to an Organization");
    }
    const organizationUnit = await prisma.organizationUnit.findUnique({
        where:{id:unitId},
        include:{
            _count:{
                select:{
                    users: true
                }
            },
            children:{
                select:{
                    allocatedCapacity: true
                }
            },
            parent:{
                include:{
                    _count:{
                        select:{
                            users: true
                        }
                    },
                    children:{
                        select:{
                            id: true,
                            allocatedCapacity: true
                        }
                    }
                }
            }
        }
    });
    if(!organizationUnit){
        throw new ApiError(404,"Organization unit not Found");
    }
    if(organizationUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Organization unit does not belong to your organization");
    }
    const directMembers = organizationUnit._count.users;
    const childAllocations = organizationUnit.children.reduce((total,child)=>{
        return total+(child.allocatedCapacity || 0);
    },
    0 
   );
   const usedCapacity = directMembers + childAllocations;
   if(allocatedCapacity < usedCapacity){
    throw new ApiError(400,`Allocated capacity cannot be less than current usage of ${usedCapacity}`);
   }
   if(organizationUnit.parent){
        const parentUnit = organizationUnit.parent;

        if(parentUnit.allocatedCapacity === null){
            throw new ApiError(
                400,
                "Parent unit capacity must be configured first"
            );
        }

        const siblingAllocations = parentUnit.children.reduce(
            (total, child)=>{
                if(child.id === organizationUnit.id){
                    return total;
                }

                return total + (child.allocatedCapacity || 0);
            },
            0
        );

        const parentDirectMembers =
            parentUnit._count.users;

        const parentAvailableCapacity =
            parentUnit.allocatedCapacity -
            parentDirectMembers -
            siblingAllocations;

        if(allocatedCapacity > parentAvailableCapacity){
            throw new ApiError(
                400,
                `Allocated capacity cannot exceed parent available capacity of ${parentAvailableCapacity}`
            );
        }
    }
   const updatedOrganizationUnit = await prisma.organizationUnit.update({
    where:{id: unitId},
    data:{allocatedCapacity} 
   });
   return updatedOrganizationUnit;
};

export const updateMemberRole = async(userId,memberId,memberData)=>{
    const {role} = memberData;
    const validRoles = ["ADMIN","MANAGER","MEMBER"];
    if(!validRoles.includes(role)){
        throw new ApiError(400,"Invlaid member role");
    }

    const user = await prisma.user.findUnique({
        where:{id: userId},
        include:{unit: true}
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(404,"User does not belong to an organization");
    }
    const member = await prisma.user.findUnique({
        where:{id: memberId},
        include:{unit: true }
    });

    if(!member){
        throw new ApiError(404,"Member not Found");
    }
    if(!member.unitId || !member.unit){
        throw new ApiError(400,"Member does not belong to an organization");
    }
    if(member.unit.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Member does not belong to your organization");
    }
    if(member.role === "OWNER"){
        throw new ApiError(403,"Organization owner role cannot be changed");
    }
    const canAssignRole = await hasPermission(userId,"ASSIGN_ROLE",member.unitId);
    if(!canAssignRole){
        throw new ApiError(403,"You do not have permission to assign roles to this member");
    }

    const updatedMember = await prisma.user.update({
        where:{id: memberId},
        data:{role},
        select:{
            id: true,
            fullName: true,
            email: true,
            role: true,
            unitId: true,
            unit:{
                select:{
                    id: true,
                    name: true,
                    type: true 
                }
            }
        }
    });
    return updatedMember;
}

export const moveMember = async(userId,memberId,memberData)=>{
    const {unitId} = memberData;

    if(!unitId){
        throw new ApiError(400,"Destination organization unit is required");
    }

    const user = await prisma.user.findUnique({
        where:{
            id: userId
        },
        include:{
            unit: true
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    const member = await prisma.user.findUnique({
        where:{
            id: memberId
        },
        include:{
            unit: true
        }
    });

    if(!member){
        throw new ApiError(
            404,
            "Member not Found"
        );
    }

    if(!member.unitId || !member.unit){
        throw new ApiError(
            400,
            "Member does not belong to an organization"
        );
    }

    if(
        member.unit.organizationId !==
        user.unit.organizationId
    ){
        throw new ApiError(
            403,
            "Member does not belong to your organization"
        );
    }

    if(member.role === "OWNER"){
        throw new ApiError(
            403,
            "Organization owner cannot be moved"
        );
    }

    if(member.unitId === unitId){
        throw new ApiError(
            400,
            "Member already belongs to this organization unit"
        );
    }

    const destinationUnit =await prisma.organizationUnit.findUnique({
            where:{id: unitId},
            include:{
                _count:{
                    select:{
                        users: true
                    }
                },
                children:{
                    select:{
                        allocatedCapacity: true
                    }
                }
            }
        });

    if(!destinationUnit){
        throw new ApiError(404,"Destination organization unit not Found");
    }

    if(destinationUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Destination unit does not belong to your organization");
    }

    const canMoveMember = await hasPermission(
        userId,
        "MOVE_MEMBER",
        member.unitId
    );

    if(!canMoveMember){
        throw new ApiError(403,"You do not have permission to move this member");
    }

    const canMoveToDestination = await hasPermission(
        userId,
        "MOVE_MEMBER",
        unitId
    );

    if(!canMoveToDestination){
        throw new ApiError(
            403,
            "You do not have permission to move members into the destination unit"
        );
    }

    if(destinationUnit.allocatedCapacity === null){
        throw new ApiError(
            400,
            "Destination unit capacity must be configured first"
        );
    }

    const directMembers =
        destinationUnit._count.users;

    const childAllocations =
        destinationUnit.children.reduce(
            (total,child)=>{
                return total +
                    (child.allocatedCapacity || 0);
            },
            0
        );

    const remainingCapacity =
        destinationUnit.allocatedCapacity -
        directMembers -
        childAllocations;

    if(remainingCapacity <= 0){
        throw new ApiError(
            400,
            "Destination organization unit has no remaining capacity"
        );
    }

    const updatedMember = await prisma.user.update({
        where:{
            id: memberId
        },
        data:{
            unitId
        },
        select:{
            id: true,
            fullName: true,
            email: true,
            role: true,
            unitId: true,
            unit:{
                select:{
                    id: true,
                    name: true,
                    type: true
                }
            }
        }
    });

    return updatedMember;
};

export const removeMember = async(userId, memberId)=>{
    const user = await prisma.user.findUnique({
        where:{id:userId},
        include:{unit:true}
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    const member = await prisma.user.findUnique({
        where:{id:memberId},
        include:{unit:true}
    });

    if(!member){
        throw new ApiError(404,"Member not Found");
    }

    if(!member.unitId || !member.unit){
        throw new ApiError(
            400,
            "Member does not belong to an organization"
        );
    }

    if(member.unit.organizationId !== user.unit.organizationId){
        throw new ApiError(
            403,
            "Member does not belong to your organization"
        );
    }

    if(member.role === "OWNER"){
        throw new ApiError(
            403,
            "Organization owner cannot be removed"
        );
    }

    const canRemoveMember = await hasPermission(
        userId,
        "REMOVE_MEMBER",
        member.unitId
    );

    if(!canRemoveMember){
        throw new ApiError(
            403,
            "You do not have permission to remove this member"
        );
    }

    const removedMember = await prisma.$transaction(async(tx)=>{
        await tx.permissionGrant.updateMany({
            where:{
                userId:memberId,
                organizationId:user.unit.organizationId,
                revokedAt:null
            },
            data:{
                revokedAt:new Date()
            }
        });

        return tx.user.update({
            where:{id:memberId},
            data:{
                role:null,
                unitId:null
            },
            select:{
                id:true,
                fullName:true,
                email:true,
                role:true,
                unitId:true
            }
        });
    });

    return removedMember;
};

export const moveOrganizationUnit = async(
    userId,
    unitId,
    unitData
)=>{
    const {parentId} = unitData;

    if(!parentId){
        throw new ApiError(
            400,
            "Destination parent unit is required"
        );
    }

    const user = await prisma.user.findUnique({
        where:{
            id:userId
        },
        include:{
            unit:true
        }
    });

    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does not belong to an organization"
        );
    }

    const organizationUnit =
        await prisma.organizationUnit.findUnique({
            where:{
                id:unitId
            }
        });

    if(!organizationUnit){
        throw new ApiError(
            404,
            "Organization unit not Found"
        );
    }

    if(
        organizationUnit.organizationId !==
        user.unit.organizationId
    ){
        throw new ApiError(
            403,
            "Organization unit does not belong to your organization"
        );
    }

    if(organizationUnit.type === "COMPANY"){
        throw new ApiError(
            400,
            "COMPANY organization unit cannot be moved"
        );
    }

    if(organizationUnit.parentId === parentId){
        throw new ApiError(
            400,
            "Organization unit already belongs to this parent"
        );
    }

    const destinationUnit =
        await prisma.organizationUnit.findUnique({
            where:{
                id:parentId
            },
            include:{
                _count:{
                    select:{
                        users:true
                    }
                },
                children:{
                    select:{
                        id:true,
                        allocatedCapacity:true
                    }
                }
            }
        });

    if(!destinationUnit){
        throw new ApiError(
            404,
            "Destination organization unit not Found"
        );
    }

    if(
        destinationUnit.organizationId !==
        user.unit.organizationId
    ){
        throw new ApiError(
            403,
            "Destination unit does not belong to your organization"
        );
    }

    const validParents = {
        DEPARTMENT:"COMPANY",
        TEAM:"DEPARTMENT",
        GROUP:"TEAM"
    };

    if(
        validParents[organizationUnit.type] !==
        destinationUnit.type
    ){
        throw new ApiError(
            400,
            `${organizationUnit.type} cannot be moved under ${destinationUnit.type}`
        );
    }

    const destinationInsideSubtree =
        await isUnitInsideScope(
            organizationUnit.id,
            destinationUnit.id
        );

    if(destinationInsideSubtree){
        throw new ApiError(
            400,
            "Organization unit cannot be moved inside its own subtree"
        );
    }

    const canMoveUnit = await hasPermission(
        userId,
        "MOVE_UNIT",
        organizationUnit.id
    );

    if(!canMoveUnit){
        throw new ApiError(
            403,
            "You do not have permission to move this organization unit"
        );
    }

    const canMoveToDestination = await hasPermission(
        userId,
        "MOVE_UNIT",
        destinationUnit.id
    );

    if(!canMoveToDestination){
        throw new ApiError(
            403,
            "You do not have permission to move units into the destination scope"
        );
    }

    if(destinationUnit.allocatedCapacity === null){
        throw new ApiError(
            400,
            "Destination unit capacity must be configured first"
        );
    }

    const directMembers =
        destinationUnit._count.users;

    const childAllocations =
        destinationUnit.children.reduce(
            (total,child)=>{
                return total +
                    (child.allocatedCapacity || 0);
            },
            0
        );

    const destinationAvailableCapacity =
        destinationUnit.allocatedCapacity -
        directMembers -
        childAllocations;

    const requiredCapacity =
        organizationUnit.allocatedCapacity || 0;

    if(requiredCapacity > destinationAvailableCapacity){
        throw new ApiError(
            400,
            `Destination unit has only ${destinationAvailableCapacity} available capacity`
        );
    }

    const updatedOrganizationUnit =
        await prisma.organizationUnit.update({
            where:{
                id:unitId
            },
            data:{
                parentId
            }
        });

    return updatedOrganizationUnit;
};