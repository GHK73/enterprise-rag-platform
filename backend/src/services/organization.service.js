// backend/src/services/organization.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

export const createOrganization = async(userId, organizationData)=>{
    const {name,description} = organizationData;

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
                organizationId: organization.id
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
            id:userId 
        },
        include:{
            unit:true 
        }
    });
    if(!user){
        throw new ApiError(404, "User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(
            404,
            "User does nto belong to an organization"
        );
    }
    if(user.role != "OWNER" && user.role !== "ADMIN"){
        throw new ApiError(
            403,
            "You don not have permission to create organization units"
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
        throw new ApiError(404,"Parent organization unit not Found");
    }

    if(parentUnit.organizationId !== user.unit.organizationId){
        throw new ApiError(
            403,
            "Parent unit does not belong to your organization"
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