import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

import { hasPermission } from "../permission.service.js";
import {
    getDocument,
    getActiveDocument,
    getDocumentAccessPolicy,
} from "./documentHelpers.js";
const MAX_TEMPORARY_ACCESS_DAYS = 7;

const resolveAccessSubject = async(tx,organizationId,accessData)=>{
    const {
        subjectType,
        subjectOrganizationId,
        subjectUnitId,
        subjectRole,
        subjectUserId,
        scope,
    } = accessData;

    switch(subjectType){

        case "ORGANIZATION":

            if(!subjectOrganizationId){
                throw new ApiError(
                    400,
                    "Organization is required"
                );
            }

            if(subjectOrganizationId !== organizationId){
                throw new ApiError(
                    400,
                    "Invalid organization."
                );
            }

            return {
                subjectType,
                subjectOrganizationId,
                subjectUnitId:null,
                subjectRole:null,
                subjectUserId:null,
                scope:null,
            };

        case "UNIT":{

            if(!subjectUnitId){
                throw new ApiError(
                    400,
                    "Organization unit is required"
                );
            }

            const unit =
                await tx.organizationUnit.findUnique({
                    where:{id:subjectUnitId,},
                });

            if(!unit || unit.organizationId!==organizationId){
                throw new ApiError(
                    400,
                    "Invalid organization unit."
                );
            }

            return {
                subjectType,
                subjectOrganizationId:null,
                subjectUnitId,
                subjectRole:null,
                subjectUserId:null,
                scope,
            };
        }

        case "ROLE":

            if(!subjectRole){
                throw new ApiError(
                    400,
                    "Role is required"
                );
            }

            return {
                subjectType,
                subjectOrganizationId:null,
                subjectUnitId:null,
                subjectRole,
                subjectUserId:null,
                scope:null,
            };

        case "USER":{

            if(!subjectUserId){
                throw new ApiError(
                    400,
                    "User is required"
                );
            }

            const member =
                await tx.user.findUnique({
                    where:{id:subjectUserId,},
                    include:{unit:true,},
                });

            if(
                !member ||
                member.unit?.organizationId!==organizationId
            ){
                throw new ApiError(
                    400,
                    "Invalid organization user."
                );
            }

            return {
                subjectType,
                subjectOrganizationId:null,
                subjectUnitId:null,
                subjectRole:null,
                subjectUserId,
                scope:null,
            };
        }

        default:
            throw new ApiError(
                400,
                "Invalid access subject type."
            );
    }
};

const validateDocumentAccessPolicy = async(
    tx,
    document,
    accessData
)=>{
    const {
        subjectType,
        action,
        effect,
        scope,
        validFrom,
        validUntil,
        subjectOrganizationId,
        subjectUnitId,
        subjectRole,
        subjectUserId,
    } = accessData;

    if(subjectType==="UNIT"){

        if(!scope){
            throw new ApiError(
                400,
                "Unit access policies require a scope."
            );
        }

    }else if(scope){

        throw new ApiError(
            400,
            "Only unit access policies may define a scope."
        );

    }

    if(validUntil){
        const start = validFrom ?? new Date();

        if(validUntil<=start){
            throw new ApiError(
                400,
                "validUntil must be later than validFrom."
            );
        }
    }

    const existingPolicy =
        await tx.documentAccessPolicy.findFirst({
            where:{
                documentId:document.id,

                subjectType,

                subjectOrganizationId:
                    subjectOrganizationId ?? null,

                subjectUnitId:
                    subjectUnitId ?? null,

                subjectRole:
                    subjectRole ?? null,

                subjectUserId:
                    subjectUserId ?? null,

                action,
                effect,

                isActive:true,
            },
        });

    if(existingPolicy){
        throw new ApiError(
            409,
            "An identical active access policy already exists."
        );
    }

    return true;
};

const resolveDocumentAccessTargetUnit = async(
    tx,
    document,
    accessData
)=>{
    switch(accessData.subjectType){

        case "USER":{

            const member =
                await tx.user.findUnique({
                    where:{id:accessData.subjectUserId,},
                    select:{unitId:true,},
                });

            if(!member || !member.unitId){
                throw new ApiError(
                    400,
                    "Target user does not belong to an organization unit."
                );
            }

            return member.unitId;
        }

        case "UNIT":
            return accessData.subjectUnitId;

        case "ORGANIZATION":
        case "ROLE":{

            const rootUnit =
                await tx.organizationUnit.findFirst({
                    where:{
                        organizationId:document.organizationId,
                        type:"COMPANY",
                    },
                    select:{id:true,},
                });

            if(!rootUnit){
                throw new ApiError(
                    500,
                    "Root organization unit not found."
                );
            }

            return rootUnit.id;
        }

        default:
            throw new ApiError(
                400,
                "Invalid access subject type."
            );
    }
};

const validateDocumentAccessAuthority = async(
    tx,
    user,
    document,
    accessData
)=>{
    const targetUnitId =
        await resolveDocumentAccessTargetUnit(
            tx,
            document,
            accessData
        );

    const allowed =
        await hasPermission(
            user.id,
            "MANAGE_ACCESS",
            targetUnitId,
            tx
        );

    if(!allowed){
        throw new ApiError(
            403,
            "You do not have permission to manage document access for the requested scope."
        );
    }

    return targetUnitId;
};

const isDocumentAccessPolicyActive = (policy)=>{
    if(!policy.isActive){
        return false;
    }

    const now = new Date();

    if(
        policy.validFrom &&
        policy.validFrom > now
    ){
        return false;
    }

    if(
        policy.validUntil &&
        policy.validUntil <= now
    ){
        return false;
    }

    return true;
};

const validateTemporaryAccess = (
    validFrom,
    validUntil
)=>{
    if(!validUntil){
        return;
    }

    const start = validFrom ?? new Date();

    if(validUntil <= start){
        throw new ApiError(
            400,
            "validUntil must be later than validFrom."
        );
    }

    const maximumEnd = new Date(
        start.getTime() +
        MAX_TEMPORARY_ACCESS_DAYS *
        24 *
        60 *
        60 *
        1000
    );

    if(validUntil > maximumEnd){
        throw new ApiError(
            400,
            `Temporary access cannot exceed ${MAX_TEMPORARY_ACCESS_DAYS} days.`
        );
    }
};

export const grantDocumentAccess = async(
    user,
    documentId,
    accessData
)=>{
    const document = await getActiveDocument(
        user,
        documentId
    );

    return prisma.$transaction(async(tx)=>{

        const resolvedAccessData =
            await resolveAccessSubject(
                tx,
                document.organizationId,
                accessData
            );

        await validateDocumentAccessPolicy(
            tx,
            document,
            resolvedAccessData
        );

        await validateDocumentAccessAuthority(
            tx,
            user,
            document,
            resolvedAccessData
        );

        const policy =
            await tx.documentAccessPolicy.create({
                data:{
                    organizationId:
                        document.organizationId,

                    documentId:
                        document.id,

                    ...resolvedAccessData,

                    action:
                        accessData.action,

                    effect:
                        accessData.effect,

                    validFrom:
                        accessData.validFrom ??
                        new Date(),

                    validUntil:
                        accessData.validUntil ??
                        null,

                    grantedById:
                        user.id,
                },
            });

        await tx.documentAccessAudit.create({
            data:{
                organizationId:
                    policy.organizationId,

                documentId:
                    policy.documentId,

                policyId:
                    policy.id,

                actorId:
                    user.id,

                subjectType:
                    policy.subjectType,

                subjectOrganizationId:
                    policy.subjectOrganizationId,

                subjectUnitId:
                    policy.subjectUnitId,

                subjectRole:
                    policy.subjectRole,

                subjectUserId:
                    policy.subjectUserId,

                eventType:"CREATED",

                previousState:null,

                newState:{
                    action:policy.action,
                    effect:policy.effect,
                    scope:policy.scope,
                    validFrom:policy.validFrom,
                    validUntil:policy.validUntil,
                    isActive:policy.isActive,
                },

                reason:
                    accessData.reason ??
                    null,
            },
        });

        return policy;
    });
};

export const updateDocumentAccessPolicy = async(
    user,
    policyId,
    accessData
)=>{
    return prisma.$transaction(async(tx)=>{

        const policy =await getDocumentAccessPolicy(
            user,
            policyId
        );

        if(!policy.isActive){
            throw new ApiError(
                400,
                "Access policy has already been revoked."
            );
        }

        await validateDocumentAccessAuthority(
            tx,
            user,
            policy.document,
            policy
        );

        if(
            policy.subjectType !== "UNIT" &&
            accessData.scope !== undefined
        ){
            throw new ApiError(
                400,
                "Only UNIT policies may define a scope."
            );
        }

        if(accessData.validUntil){

            const start =
                accessData.validFrom ??
                policy.validFrom ??
                new Date();

            if(accessData.validUntil <= start){
                throw new ApiError(
                    400,
                    "validUntil must be later than validFrom."
                );
            }
        }

        const updatedPolicy =
            await tx.documentAccessPolicy.update({
                where:{id:policy.id,},
                data:{
                    ...(accessData.effect!==undefined && {
                        effect:accessData.effect,
                    }),

                    ...(accessData.scope!==undefined && {
                        scope:accessData.scope,
                    }),

                    ...(accessData.validFrom!==undefined && {
                        validFrom:accessData.validFrom,
                    }),

                    ...(accessData.validUntil!==undefined && {
                        validUntil:accessData.validUntil,
                    }),
                },
            });

        await tx.documentAccessAudit.create({
            data:{
                organizationId:
                    updatedPolicy.organizationId,

                documentId:
                    updatedPolicy.documentId,

                policyId:
                    updatedPolicy.id,

                actorId:user.id,

                subjectType:
                    updatedPolicy.subjectType,

                subjectOrganizationId:
                    updatedPolicy.subjectOrganizationId,

                subjectUnitId:
                    updatedPolicy.subjectUnitId,

                subjectRole:
                    updatedPolicy.subjectRole,

                subjectUserId:
                    updatedPolicy.subjectUserId,

                eventType:"UPDATED",

                previousState:{
                    effect:policy.effect,
                    scope:policy.scope,
                    validFrom:policy.validFrom,
                    validUntil:policy.validUntil,
                },

                newState:{
                    effect:updatedPolicy.effect,
                    scope:updatedPolicy.scope,
                    validFrom:updatedPolicy.validFrom,
                    validUntil:updatedPolicy.validUntil,
                },

                reason:
                    accessData.reason ??
                    null,
            },
        });

        return updatedPolicy;
    });
};

export const revokeDocumentAccess = async(
    user,
    policyId,
    reason
)=>{
    return prisma.$transaction(async(tx)=>{

        const policy =await getDocumentAccessPolicy(
            user,
            policyId
        );

        if(!policy.isActive){
            throw new ApiError(
                400,
                "Access policy is already revoked."
            );
        }

        await validateDocumentAccessAuthority(
            tx,
            user,
            policy.document,
            policy
        );

        const revokedPolicy =
            await tx.documentAccessPolicy.update({
                where:{id:policy.id,},
                data:{
                    isActive:false,
                    revokedAt:new Date(),
                    revokedById:user.id,
                },
            });

        await tx.documentAccessAudit.create({
            data:{
                organizationId:
                    revokedPolicy.organizationId,

                documentId:
                    revokedPolicy.documentId,

                policyId:
                    revokedPolicy.id,

                actorId:user.id,

                subjectType:
                    revokedPolicy.subjectType,

                subjectOrganizationId:
                    revokedPolicy.subjectOrganizationId,

                subjectUnitId:
                    revokedPolicy.subjectUnitId,

                subjectRole:
                    revokedPolicy.subjectRole,

                subjectUserId:
                    revokedPolicy.subjectUserId,

                eventType:"REVOKED",

                previousState:{
                    isActive:true,
                },

                newState:{
                    isActive:false,
                },

                reason:reason ?? null,
            },
        });

        return revokedPolicy;
    });
};

export const getDocumentAccessPolicies = async(
    user,
    documentId
)=>{
    await getDocument(
        user,
        documentId
    );

    return prisma.documentAccessPolicy.findMany({
        where:{documentId,},
        orderBy:{
            createdAt:"desc",
        },
    });
};

export const getDocumentAccessHistory = async(
    user,
    documentId
)=>{
    await getDocument(
        user,
        documentId
    );

    return prisma.documentAccessAudit.findMany({
        where:{documentId,},
        orderBy:{
            createdAt:"desc",
        },
    });
};

export const getDocumentAccessPolicyById = async(
    user,
    policyId
)=>{
    return getDocumentAccessPolicy(
        user,
        policyId
    );
};

export const grantTemporaryDocumentAccess = async(user,documentId,accessData)=>{
    validateTemporaryAccess(
        accessData.validFrom,
        accessData.validUntil
    );

    return grantDocumentAccess(
        user,
        documentId,
        accessData
    );
};

export const authorizeDocumentAction = async(user,documentId,action)=>{
    const document = await getActiveDocument(
        user,
        documentId
    );

    const policies =
        await prisma.documentAccessPolicy.findMany({
            where:{
                documentId,
                action,
            },
        });

    const activePolicies =
        policies.filter(
            isDocumentAccessPolicyActive
        );

    const matches = [];

    for(const policy of activePolicies){

        switch(policy.subjectType){

            case "ORGANIZATION":

                if(policy.subjectOrganizationId===user.unit.organizationId){
                    matches.push(policy);
                }

                break;

            case "UNIT":

                if(policy.subjectUnitId===user.unitId){
                    matches.push(policy);
                }

                break;

            case "ROLE":

                if(policy.subjectRole===user.role){
                    matches.push(policy);
                }

                break;

            case "USER":

                if(policy.subjectUserId===user.id){
                    matches.push(policy);
                }

                break;
        }
    }

    if(matches.some(policy=>policy.effect==="DENY")){
        throw new ApiError(
            403,
            "Access denied."
        );
    }

    if(matches.some(policy=>policy.effect==="ALLOW")){
        return {
            document,
            authorized:true,
        };
    }

    throw new ApiError(
        403,
        "Access denied."
    );
};