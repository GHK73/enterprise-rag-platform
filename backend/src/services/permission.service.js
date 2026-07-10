// backend/src/services/permission.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const validateOrganizationMembership = (user)=>{
    if(!user.unitId || !user.unit){
        throw new ApiError(403,"User does not belong to an organization");
    }
};

export const isUnitInsideScope = async(
    scopeUnitId,
    targetUnitId,
    db=prisma
)=>{
    if(scopeUnitId === targetUnitId){
        return true;
    }

    let currentUnit = await db.organizationUnit.findUnique({
        where:{id:targetUnitId},
        select:{parentId:true}
    });

    while(currentUnit?.parentId){
        if(currentUnit.parentId === scopeUnitId){
            return true;
        }

        currentUnit = await db.organizationUnit.findUnique({
            where:{id:currentUnit.parentId},
            select:{parentId:true}
        });
    }

    return false;
};

export const hasPermission = async(
    userId,
    permission,
    targetUnitId,
    db=prisma
)=>{
    const targetUnit = await db.organizationUnit.findUnique({
        where:{id:targetUnitId}
    });

    if(!targetUnit){
        return false;
    }

    const permissionGrants = await db.permissionGrant.findMany({
        where:{
            userId,
            permission,
            organizationId:targetUnit.organizationId,
            isActive:true
        }
    });

    for(const permissionGrant of permissionGrants){
        const isInsideScope = await isUnitInsideScope(
            permissionGrant.scopeUnitId,
            targetUnitId,
            db
        );

        if(isInsideScope){
            return true;
        }
    }

    return false;
};

export const grantPermission = async(user,permissionData)=>{
    const {
        recipientId,
        permission,
        scopeUnitId,
        canDelegate
    } = permissionData;

    validateOrganizationMembership(user);

    const recipient = await prisma.user.findUnique({
        where:{id:recipientId},
        include:{unit:true}
    });

    if(!recipient){
        throw new ApiError(404,"Recipient not Found");
    }

    if(!recipient.unitId || !recipient.unit){
        throw new ApiError(400,"Recipient does not belong to an organization");
    }

    if(recipient.unit.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Recipient does not belong to your organization");
    }

    const scopeUnit = await prisma.organizationUnit.findUnique({
        where:{id:scopeUnitId}
    });

    if(!scopeUnit){
        throw new ApiError(404,"Scope organization unit not Found");
    }

    if(scopeUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Scope unit does not belong to your organization");
    }

    const permissionGrants = await prisma.permissionGrant.findMany({
        where:{
            userId:user.id,
            permission,
            organizationId:user.unit.organizationId,
            canDelegate:true,
            isActive:true
        }
    });

    let validPermissionGrant = null;

    for(const permissionGrant of permissionGrants){
        const recipientInsideScope = await isUnitInsideScope(
            permissionGrant.scopeUnitId,
            recipient.unitId
        );

        const newScopeInsideScope = await isUnitInsideScope(
            permissionGrant.scopeUnitId,
            scopeUnitId
        );

        if(recipientInsideScope && newScopeInsideScope){
            validPermissionGrant = permissionGrant;
            break;
        }
    }

    if(!validPermissionGrant){
        throw new ApiError(
            403,
            "You cannot delegate this permission within the requested scope"
        );
    }

    const existingPermissionGrant = await prisma.permissionGrant.findFirst({
        where:{
            userId:recipientId,
            permission,
            scopeUnitId,
            isActive:true
        }
    });

    if(existingPermissionGrant){
        throw new ApiError(
            400,
            "Recipient already has this permission for the selected scope"
        );
    }

    return prisma.permissionGrant.create({
        data:{
            permission,
            organizationId:user.unit.organizationId,
            userId:recipientId,
            scopeUnitId,
            grantedById:user.id,
            canDelegate:canDelegate ?? false
        }
    });
};

export const revokePermission = async(user,permissionGrantId)=>{
    validateOrganizationMembership(user);

    const permissionGrant = await prisma.permissionGrant.findUnique({
        where:{id:permissionGrantId}
    });

    if(!permissionGrant){
        throw new ApiError(404,"Permission grant not Found");
    }

    if(permissionGrant.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Permission grant does not belong to your organization");
    }

    if(!permissionGrant.isActive){
        throw new ApiError(400,"Permission grant is already revoked");
    }

    if(permissionGrant.grantedById !== user.id){
        throw new ApiError(403,"You cannot revoke this permission grant");
    }

    return prisma.permissionGrant.update({
        where:{id:permissionGrantId},
        data:{
            isActive:false,
            revokedAt:new Date()
        }
    });
};

export const getUserPermissions = async(user)=>{
    validateOrganizationMembership(user);

    return prisma.permissionGrant.findMany({
        where:{
            userId:user.id,
            organizationId:user.unit.organizationId,
            isActive:true
        },
        include:{
            scopeUnit:{
                select:{
                    id:true,
                    name:true,
                    type:true
                }
            },
            grantedBy:{
                select:{
                    id:true,
                    fullName:true,
                    email:true
                }
            }
        },
        orderBy:{
            createdAt:"asc"
        }
    });
};

export const getMemberPermissionHistory = async(user,memberId)=>{
    validateOrganizationMembership(user);

    const member = await prisma.user.findUnique({
        where:{id:memberId},
        include:{unit:true}
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

    return prisma.permissionGrant.findMany({
        where:{
            userId:memberId,
            organizationId:user.unit.organizationId
        },
        include:{
            scopeUnit:{
                select:{
                    id:true,
                    name:true,
                    type:true
                }
            },
            grantedBy:{
                select:{
                    id:true,
                    fullName:true,
                    email:true
                }
            }
        },
        orderBy:{
            createdAt:"desc"
        }
    });
};