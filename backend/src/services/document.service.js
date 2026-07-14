// backend/src/services/document.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {randomUUID} from "crypto";
import {validateFile} from "../utils/fileValidation.js";
import {hasPermission,} from "./permission.service.js";
import {
    uploadFileToS3,
    deleteFileFromS3, 
} from "./s3.service.js";

const DRAFT_EXPIRY_HOURS = 24;

const validClassifications = [
    "GENERAL",
    "INTERNAL",
    "CONFIDENTIAL",
    "RESTRICTED"
];

const getDraftDocument = async(user, documentId)=>{
    const document = await prisma.document.findUnique({
        where:{id: documentId,},
    });
    if(!document){
        throw new ApiError(404,"Document not found");
    }
    if(document.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Document does not belong to your Organization");
    }
    if(document.status !== "DRAFT"){
        throw new ApiError(400,"Only draft documents can be modified");
    }
    if(isDraftExpired(document)){
        await expireDraftIfNeeded(document);
        throw new ApiError(400,"Document draft has expired");
    }
    return document;
}

const cleanupDraftUpload = async (tx, document, version)=>{
    await tx.documentVersion.delete({
        where:{id: version.id,},
    });
    await tx.document.update({
        where:{id: document.id,},
        data:{
            currentVersionId: null,
        },
    });
};

const validateDraftForPublication = async(user, documentId)=>{
    validateOrganizationMembership(user);
    const document = await getDraftDocument(user,documentId);
    if(!document.title?.trim()){
        throw new ApiError(400,"Document title is required");
    }
    if(!validClassifications.includes(document.classification)){
        throw new ApiError(400,"Invalid document classification.");
    }
    if(!document.currentVersionId){
        throw new ApiError(400,"A draft file must be uploaded before publication");
    }
    const version = await prisma.documentVersion.findUnique({
        where:{id: document.currentVersionId,},
    });
    if(!version){
        throw new ApiError(400,"Draft upload not found.");
    }

    return {document, version};
};

const validDocumentTransitions = {
    DRAFT:["SUBMITTED","EXPIRED"],
    SUBMITTED:["QUEUED"],
    QUEUED:["PROCESSING"],
    PROCESSING:["READY","FAILED"],
    READY:["DELETED"]
};

const validateOrganizationMembership = (user)=>{
    if(!user.unitId || !user.unit){
        throw new ApiError(403,"User does not belong to an organization");
    }
};

const isDraftExpired = (document)=>{
    return(
        document.status === "DRAFT" &&
        document.draftExpiresAt &&
        document.draftExpiresAt <= new Date()
    );
};

const expireDraftIfNeeded = async(document)=>{
    if(!isDraftExpired(document))return document;

    return prisma.document.update({
        where:{id:document.id},
        data:{status:"EXPIRED"}
    });
};

const expireOrganizationDrafts = async(organizationId)=>{
    return prisma.document.updateMany({
        where:{
            organizationId,
            status:"DRAFT",
            draftExpiresAt:{
                lte:new Date()
            }
        },
        data:{
            status:"EXPIRED"
        }
    });
};

const createInitialDocumentAccessPolicies = async(tx, user, document)=>{
    const actions = [
        "QUERY",
        "VIEW",
        "DOWNLOAD",
        "MANAGE_ACCESS",
    ];
    const policies = [];
    for(const action of actions){
        const policy = await tx.documentAccessPolicy.create({
            data:{
                organizationId: document.organizationId,
                documentId: document.id,
                subjectType: "USER",
                subjectUserId: user.id,
                action,
                effect:"ALLOW",
                grantedById: user.id, 
            }, 
        });
        policies.push(policy);
    }
    return policies;
};

const createInitialDocumentAccessAudit = async(tx, user, policies)=>{
    for(const policy of policies){
        await tx.documentAccessAudit.create({
            data:{
                organizationId: policy.organizationId,
                documentId: policy.documentId,
                policyId: policy.id,
                actorId: user.id,
                subjectType: policy.subjectType,
                subjectOrganizationId: policy.subjectOrganizationId,
                subjectUnitId: policy.subjectUnitId,
                subjectRole: policy.subjectRole,
                subjectUserId: policy.subjectUserId,
                eventType:"CREATED",
                previousState: null,
                newState:{
                    action: policy.action,
                    effect:policy.effect,
                    scope: policy.scope,
                    validFrom: policy.validFrom,
                    validUntil: policy.validUntil,
                    isActive: policy.isActive, 
                },
                reason: "Initial document publication.",
            },
        });
    }
};

const resolveAccessSubject = async(tx, organizationId, accessData)=>{
    const{subjectType, subjectOrganizationId, subjectUnitId, subjectRole, subjectUserId,scope} = accessData;
    switch(subjectType){
        case "ORGANIZATION":{
            if(!subjectOrganizationId){
                throw new ApiError(400,"Organization is required");
            }
            if(subjectOrganizationId !== organizationId){
                throw new ApiError(400,"Invali organization.");
            }
            return{
                subjectType,
                subjectOrganizationId,
                subjectUnitId: null,
                subjectRole: null,
                subjectUserId: null,
                scope: null,
            };
        }
        case "UNIT":{
            if(!subjectUnitId){
                throw new ApiError(400,"Organization unit is required");
            }
            const unit = await tx.organizationUnit.findUnique({
                where:{ id:subjectUnitId,},
            });
            if(!unit || unit.organizationId !== organizationId){
                throw new ApiError(400,"Invalid organization unit.");
            }
            return {
                subjectType,
                subjectOrganizationId: null,
                subjectUnitId,
                subjectRole: null,
                subjectUserId: null,
                scope,
            };
        }

        case "ROLE":{
            if(!subjectRole){
                throw new ApiError(400,"Role is required");
            }
            return {
                subjectType,
                subjectOrganizationId: null,
                subjectUnitId: null,
                subjectRole,
                subjectUserId: null,
                scope: null,
            };
        }
        case "USER":{
            if(!subjectUserId){
                throw new ApiError(400,"User is required");
            }
            const member = await tx.user.findUnique({
                where:{id: subjectUserId,},
                include:{unit:true,},
            });
            if(!member || member.unit?.organizationId !== organizationId){
                throw new ApiError(400,"Invalide organization user.");
            }
            return {
                subjectType,
                subjectOrganizationId: null,
                subjectUnitId: null,
                subjectRole: null,
                subjectUserId,
                scope: null,
            };
        }
        default:
            throw new ApiError(400,"Invalid access subject type.");
    }
};

const validateDocumentAccessPolicy = async(tx, document, accessData)=>{
    const {subjectType,action, effect, scope, validFrom, validUntil, subjectOrganizationId,
        subjectUnitId, subjectRole, subjectUserId, 
    } = accessData;
    if(subjectType === "UNIT"){
        if(!scope){
            throw new ApiError(400,"Unit access policies require a scope.");
        }
    }else if(scope){
        throw new ApiError(400,"Only unit access policied may define a scope.");
    }
    if(validUntil){
        const start = validFrom ?? new Date();
        if(validUntil <= start){
            throw new ApiError(400,"validUtil msut be later than validFrom");
        }
    }
    const existingPolicy = await tx.documentAccessPolicy.findFirst({
        where:{documentId: document.id,
            subjectType,
            subjectOrganizationId: subjectOrganizationId ?? null,
            subjectUnitId: subjectUnitId ?? null,
            subjectRole: subjectRole ?? null,
            subjectUserId: subjectUserId ?? null,
            action,
            effect,
            isActive: true,
        },
    });
    if(existingPolicy){
        throw new ApiError(409,"An identical active access policy already exists.");
    }
    return true;
};

const resolveDocumentAccessTargetUnit = async(tx,document,accessData)=>{
    switch(accessData.subjectType){
        case "USER":{
            const member = await tx.user.findUnique({
                where:{id: accessData.subjectUserId,},
                select:{
                    unitId: true,
                },
            });
            if(!member || !member.unitId){
                throw new ApiError(400,"Target user does not belong to an organization unit.");
            }
            return member.unitId;
        }
        case "UNIT":
            return accessData.subjectUnitId;
            
        case "ORGANIZATION":{
            const rootUnit = await tx.organizationUnit.findFirst({
                where:{organizationId: document.organizationId, type:"COMPANY",},
                select:{id: true,},
            });
            if(!rootUnit){
                throw new ApiError(500,"Root organization unit not found.");
            }
            return rootUnit.id;
        }
        case "ROLE":{
            const rootUnit = await tx.organizationUnit.findFirst({
                where:{
                    organizationId: document.organizationId,
                    type: "COMPANY",
                },
                select:{id: true,},
            });
            if(!rootUnit){
                throw new ApiError(500,"Root organization unit not found.");
            }
            return rootUnit.id;
        }
        default:
            throw new ApiError(400,"Invalid access subject type.");
    }
};

const validateDocumentAccessAuthority = async(tx,user,document,accessData)=>{
    const targetUnitId = await resolveDocumentAccessTargetUnit(
        tx,document, accessData
    );
    const allowed = await hasPermission(
        user.id,
        "MANAGE_ACCESS",
        targetUnitId,
        tx 
    );
    if(!allowed){
        throw new ApiError(403,"You do not have permission to manage document access for the requested scope.");
    }
    return targetUnitId;
};

const isDocumentAccessPolicyActive = (policy) => {

    if (!policy.isActive) {
        return false;
    }

    const now = new Date();

    if (
        policy.validFrom &&
        policy.validFrom > now
    ) {
        return false;
    }

    if (
        policy.validUntil &&
        policy.validUntil <= now
    ) {
        return false;
    }

    return true;
};

export const createDocumentDraft = async(user,documentData)=>{
    const {title,description,classification} = documentData;

    validateOrganizationMembership(user);

    if(!title || !title.trim()){
        throw new ApiError(400,"Document title is required");
    }

    if(!validClassifications.includes(classification)){
        throw new ApiError(400,"Invalid document classification");
    }

    const draftExpiresAt = new Date(
        Date.now() + DRAFT_EXPIRY_HOURS*60*60*1000
    );

    return prisma.document.create({
        data:{
            organizationId:user.unit.organizationId,
            title:title.trim(),
            description:description?.trim() || null,
            classification,
            status:"DRAFT",
            uploadedById:user.id,
            draftExpiresAt
        }
    });
};

export const expireDocumentDrafts = async(user)=>{
    validateOrganizationMembership(user);

    const result = await expireOrganizationDrafts(
        user.unit.organizationId
    );

    return {expiredDocuments:result.count};
};

export const updateDocumentDraft = async (user,documentId,documentData) => {
    const { title, description, classification } = documentData;

    validateOrganizationMembership(user);

    await getDraftDocument(user, documentId);

    if (title !== undefined && !title.trim()) {
        throw new ApiError(400, "Document title cannot be empty");
    }

    if (
        classification !== undefined &&
        !validClassifications.includes(classification)
    ) {
        throw new ApiError(400, "Invalid document classification");
    }

    return prisma.document.update({
        where: {
            id: documentId,
        },
        data: {
            ...(title !== undefined && {
                title: title.trim(),
            }),
            ...(description !== undefined && {
                description: description?.trim() || null,
            }),
            ...(classification !== undefined && {
                classification,
            }),
        },
    });
};

export const validateDocumentTransition = (
    currentStatus,
    nextStatus
)=>{
    const allowedTransitions =
        validDocumentTransitions[currentStatus] || [];

    if(!allowedTransitions.includes(nextStatus)){
        throw new ApiError(
            400,
            `Document cannot transition from ${currentStatus} to ${nextStatus}`
        );
    }

    return true;
};

export const getDocuments = async(user)=>{
    validateOrganizationMembership(user);

    await expireOrganizationDrafts(
        user.unit.organizationId
    );

    return prisma.document.findMany({
        where:{
            organizationId:user.unit.organizationId,
            isDeleted:false
        },
        orderBy:{
            createdAt:"desc"
        }
    });
};

export const getDocumentById = async(user,documentId)=>{
    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where:{id:documentId}
    });

    if(!document){
        throw new ApiError(404,"Document not Found");
    }

    if(document.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Document does not belong to your organization");
    }

    if(document.isDeleted){
        throw new ApiError(404,"Document not Found");
    }

    return expireDraftIfNeeded(document);
};

export const uploadDraft = async (user, documentId,file) => {
    validateOrganizationMembership(user);
    validateFile(file);

    const document = await getDraftDocument(
        user,
        documentId
    );

    if (document.currentVersionId) {
        throw new ApiError(
            400,
            "A file has already been uploaded for this draft."
        );
    }

    const versionId = randomUUID();

    const objectKey =
        `organizations/${user.unit.organizationId}` +
        `/drafts/${documentId}/${versionId}`;

    let uploadedObject = null;

    try {
        uploadedObject = await uploadFileToS3(
            file,
            objectKey
        );

        const result = await prisma.$transaction(async (tx) => {
            const version = await tx.documentVersion.create({
                data: {
                    id: versionId,
                    documentId,
                    versionNumber: 1,

                    storageBucket: uploadedObject.bucket,
                    storageKey: uploadedObject.key,

                    originalFileName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    checksum: uploadedObject.checksum,

                    createdById: user.id,
                },
            });

            await tx.document.update({
                where: {
                    id: documentId,
                },
                data: {
                    currentVersionId: version.id,
                },
            });

            return version;
        });

        return result;
    } catch (error) {
        if (uploadedObject) {
            try {
                await deleteFileFromS3(objectKey);
            } catch {
                // Ignore cleanup failures.
            }
        }

        throw error;
    }
};

export const deleteDraftUpload = async (user, documentId) => {
    validateOrganizationMembership(user);

    const document = await getDraftDocument(user, documentId);

    if (!document.currentVersionId) {
        throw new ApiError(404, "No uploaded file exists for this draft.");
    }

    const version = await prisma.documentVersion.findUnique({
        where: {
            id: document.currentVersionId,
        },
    });

    if (!version) {
        throw new ApiError(404, "Uploaded draft version not found.");
    }

    await prisma.$transaction(async(tx)=>{
        await cleanupDraftUpload(tx, document, version);
    })

    await deleteFileFromS3(version.storageKey);

    return {
        message: "Draft upload deleted successfully.",
    };
};

export const publishDraft = async(user,documentId)=>{
    const {document} = await validateDraftForPublication(
        user,
        documentId
    );
    validateDocumentTransition(document.status,"SUBMITTED");
    return prisma.$transaction(async (tx) => {
        const policies = await createInitialDocumentAccessPolicies(
            tx,
            user,
            document
        );
    
        await createInitialDocumentAccessAudit(
            tx,
            user,
            policies
        );
    
        return tx.document.update({
            where: {
                id: document.id,
            },
            data: {
                status: "SUBMITTED",
                submittedAt: new Date(),
            },
        });
    });
};

export const grantDocumentAccess = async (user,documentId,accessData) => {
    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(404, "Document not found.");
    }

    if (document.organizationId !== user.unit.organizationId) {
        throw new ApiError(403,"Document does not belong to your organization.");
    }

    if (document.isDeleted) {
        throw new ApiError(400,"Cannot modify access for a deleted document.");
    }

    return prisma.$transaction(async (tx) => {
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

        const policy = await tx.documentAccessPolicy.create({
            data: {
                organizationId: document.organizationId,
                documentId: document.id,

                ...resolvedAccessData,

                action: accessData.action,
                effect: accessData.effect,

                validFrom:accessData.validFrom ?? new Date(),
                validUntil:accessData.validUntil ?? null,
                grantedById: user.id,
            },
        });

        await tx.documentAccessAudit.create({
            data: {
                organizationId: policy.organizationId,
                documentId: policy.documentId,
                policyId: policy.id,
                actorId: user.id,
                subjectType: policy.subjectType,
                subjectOrganizationId:policy.subjectOrganizationId,
                subjectUnitId:policy.subjectUnitId,
                subjectRole:policy.subjectRole,
                subjectUserId:policy.subjectUserId,

                eventType: "CREATED",

                previousState: null,

                newState: {
                    action: policy.action,
                    effect: policy.effect,
                    scope: policy.scope,
                    validFrom: policy.validFrom,
                    validUntil: policy.validUntil,
                    isActive: policy.isActive,
                },

                reason:
                    accessData.reason ?? null,
            },
        });

        return policy;
    });
};

export const updateDocumentAccessPolicy = async(user, policyId, accessData)=>{
    validateOrganizationMembership(user);
    return prisma.$transaction(async(tx)=>{
        const policy = await tx.documentAccessPolicy.findUnique({
            where:{id: policyId,},
            include:{document:true,},
        });
        if(!policy){
            throw new ApiError(404,"Access policy not found.");
        }
        if(policy.document.organizationId !== user.unit.organizationId){
            throw new ApiError(403,"Document does not belong to your organization.");
        }
        if(!policy.isActive){
            throw new ApiError(400,"Access policy has already been revoked.");
        }
        await validateDocumentAccessAuthority(tx, user, policy.document, policy);
        if(policy.subjectType !== "UNIT" && accessData.scope !== undefined){
            throw new ApiError(400,"Only UNIT policies may define a scope");
        }
        if(accessData.validUntil){
            const start = accessData.validFrom ?? policy.validFrom ?? new Date();
            if(accessData.validUntil <= start){
                throw new ApiError(400,"validUntil must be later than validFrom.");
            }
        }
        const updatedPolicy = await tx.documentAccessPolicy.update({
            where:{id: policy.id},
            data:{
                ...(accessData.effect !== undefined &&{effect: accessData.effect,}),
                ...(accessData.scope !== undefined &&{scope: accessData.scope,}),
                ...(accessData.validFrom !== undefined && {validFrom: accessData.validFrom,}),
                ...(accessData.validUntil !== undefined &&{validUntil: accessData.validUntil}),
            },
        });
        await tx.documentAccessAudit.create({
            data:{
                organizationId: updatedPolicy.organizationId,
                documentId: updatedPolicy.documentId, 
                policyId: updatedPolicy.id,
                actorId: user.id,
                subjectType: updatedPolicy.subjectType,
                subjectOrganizationId: updatedPolicy.subjectOrganizationId,
                subjectUnitId: updatedPolicy.subjectUnitId,
                subjectRole: updatedPolicy.subjectRole,
                subjectUserId: updatedPolicy.subjectUserId,
                eventType: "UPDATED",
                previousState:{
                    effect: policy.effect,
                    scope: policy.scope,
                    validFrom: policy.validFrom,
                    validUntil: policy.validUntil,
                },
                newState:{
                    effect: updatedPolicy.effect,
                    scope:updatedPolicy.scope,
                    validFrom: updatedPolicy.validFrom,
                    validUntil: updatedPolicy.validUntil,
                },
                reason: accessData.reason ?? null,
            },
        });
        return updatedPolicy;
    });
};

export const revokeDocumentAccess = async (user,policyId, reason) => {
    validateOrganizationMembership(user);

    return prisma.$transaction(async (tx) => {

        const policy = await tx.documentAccessPolicy.findUnique({
            where: {
                id: policyId,
            },
            include: {
                document: true,
            },
        });

        if (!policy) {
            throw new ApiError(
                404,
                "Access policy not found."
            );
        }

        if (
            policy.document.organizationId !==
            user.unit.organizationId
        ) {
            throw new ApiError(
                403,
                "Document does not belong to your organization."
            );
        }

        if (!policy.isActive) {
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
                where: {
                    id: policy.id,
                },
                data: {
                    isActive: false,
                    revokedAt: new Date(),
                    revokedById: user.id,
                },
            });

        await tx.documentAccessAudit.create({
            data: {
                organizationId:
                    revokedPolicy.organizationId,

                documentId:
                    revokedPolicy.documentId,

                policyId:
                    revokedPolicy.id,

                actorId: user.id,

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

                eventType: "REVOKED",

                previousState: {
                    isActive: true,
                },

                newState: {
                    isActive: false,
                },

                reason: reason ?? null,
            },
        });

        return revokedPolicy;
    });
};

export const getDocumentAccessPolicies = async ( user,documentId) => {

    validateOrganizationMembership(user);
    const document =
        await prisma.document.findUnique({
            where: {
                id: documentId,
            },
        });

    if (!document) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (
        document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    return prisma.documentAccessPolicy.findMany({
        where: {
            documentId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

export const getDocumentAccessHistory = async (
    user,
    documentId
) => {

    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (
        document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    return prisma.documentAccessAudit.findMany({
        where: {
            documentId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

export const getDocumentAccessPolicyById = async (
    user,
    policyId
) => {

    validateOrganizationMembership(user);

    const policy =
        await prisma.documentAccessPolicy.findUnique({
            where: {
                id: policyId,
            },
            include: {
                document: true,
            },
        });

    if (!policy) {
        throw new ApiError(
            404,
            "Access policy not found."
        );
    }

    if (
        policy.document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    return policy;
};

const MAX_TEMPORARY_ACCESS_DAYS = 7;

const validateTemporaryAccess = (
    validFrom,
    validUntil
) => {

    if (!validUntil) {
        return;
    }

    const start = validFrom ?? new Date();

    if (validUntil <= start) {
        throw new ApiError(
            400,
            "validUntil must be later than validFrom."
        );
    }

    const maximumEnd = new Date(
        start.getTime() +
        MAX_TEMPORARY_ACCESS_DAYS * 24 * 60 * 60 * 1000
    );

    if (validUntil > maximumEnd) {
        throw new ApiError(
            400,
            `Temporary access cannot exceed ${MAX_TEMPORARY_ACCESS_DAYS} days.`
        );
    }
};

export const grantTemporaryDocumentAccess = async (
    user,
    documentId,
    accessData
) => {

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

export const authorizeDocumentAction = async (user,documentId,action) => {
    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (document.isDeleted) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (
        document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    const policies =
        await prisma.documentAccessPolicy.findMany({
            where: {
                documentId,
                action,
            },
        });

    const activePolicies =
        policies.filter(isDocumentAccessPolicyActive);

    const matches = [];

    for (const policy of activePolicies) {

        switch (policy.subjectType) {

            case "ORGANIZATION":

                if (
                    policy.subjectOrganizationId ===
                    user.unit.organizationId
                ) {
                    matches.push(policy);
                }

                break;

            case "UNIT":

                if (
                    policy.subjectUnitId === user.unitId
                ) {
                    matches.push(policy);
                }

                break;

            case "ROLE":

                if (
                    policy.subjectRole === user.role
                ) {
                    matches.push(policy);
                }

                break;

            case "USER":

                if (
                    policy.subjectUserId === user.id
                ) {
                    matches.push(policy);
                }

                break;
        }
    }

    if (
        matches.some(
            policy => policy.effect === "DENY"
        )
    ) {
        throw new ApiError(
            403,
            "Access denied."
        );
    }

    if (
        matches.some(
            policy => policy.effect === "ALLOW"
        )
    ) {
        return true;
    }

    throw new ApiError(
        403,
        "Access denied."
    );
};

export const softDeleteDocument = async (
    user,
    documentId
) => {

    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (
        document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    if (document.isDeleted) {
        throw new ApiError(
            400,
            "Document is already deleted."
        );
    }

    await authorizeDocumentAction(
        user,
        documentId,
        "MANAGE_ACCESS"
    );

    return prisma.document.update({
        where: {
            id: documentId,
        },
        data: {
            status: "DELETED",
            isDeleted: true,
            deletedAt: new Date(),
            deletedById: user.id,
        },
    });
};

export const restoreDocument = async (
    user,
    documentId
) => {

    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (
        document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    if (!document.isDeleted) {
        throw new ApiError(
            400,
            "Document is not deleted."
        );
    }

    await authorizeDocumentAction(
        user,
        documentId,
        "MANAGE_ACCESS"
    );

    return prisma.document.update({
        where: {
            id: documentId,
        },
        data: {
            status: "READY",
            isDeleted: false,
            deletedAt: null,
            deletedById: null,
        },
    });
};

export const cleanupDeletedDocument = async (
    user,
    documentId
) => {

    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
        include: {
            versions: true,
        },
    });

    if (!document) {
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if (
        document.organizationId !==
        user.unit.organizationId
    ) {
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    if (!document.isDeleted) {
        throw new ApiError(
            400,
            "Document must be deleted before cleanup."
        );
    }

    await authorizeDocumentAction(
        user,
        documentId,
        "MANAGE_ACCESS"
    );

    for (const version of document.versions) {
        try {
            await deleteFileFromS3(
                version.storageKey
            );
        } catch {
            // Ignore missing objects.
        }
    }

    await prisma.$transaction(async (tx) => {

        await tx.documentAccessAudit.deleteMany({
            where: {
                documentId,
            },
        });

        await tx.documentAccessPolicy.deleteMany({
            where: {
                documentId,
            },
        });

        await tx.documentVersion.deleteMany({
            where: {
                documentId,
            },
        });

        await tx.document.delete({
            where: {
                id: documentId,
            },
        });

    });

    return {
        message:
            "Document cleanup completed successfully.",
    };
};

export const cleanupExpiredDrafts = async (
    user
) => {

    validateOrganizationMembership(user);

    const drafts =
        await prisma.document.findMany({
            where: {
                organizationId:
                    user.unit.organizationId,
                status: "EXPIRED",
            },
            include: {
                versions: true,
            },
        });

    for (const document of drafts) {

        for (const version of document.versions) {

            try {
                await deleteFileFromS3(
                    version.storageKey
                );
            } catch {
                // Ignore cleanup failures.
            }

        }

        await prisma.$transaction(async (tx) => {

            await tx.documentVersion.deleteMany({
                where: {
                    documentId: document.id,
                },
            });

            await tx.document.delete({
                where: {
                    id: document.id,
                },
            });

        });

    }

    return {
        cleanedDrafts: drafts.length,
    };
};