// backend/src/services/organization.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

export const createOrganization = async(userId, organizationData)=>{
    const {name,description} = organizationData;
    const user = await prisma.user.findUnique({
        where:{
            id : userId
        }
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }

    if(user.unitId){
        throw new ApiError(400,"User already belongs to an organization");
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
}