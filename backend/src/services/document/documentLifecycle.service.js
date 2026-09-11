// backend/src/services/document/documentLifecycle.service.js

import { randomUUID } from "crypto";
import prisma from "../../config/prisma.js";
import {dispatchDocumentProcessing,} from "./documentProcessingDispatcher.service.js";
import ApiError from "../../utils/ApiError.js";
import { validateFile } from "../../utils/fileValidation.js";
import {
    uploadFileToS3,
    deleteFileFromS3,
    getDownloadUrlFromS3,
} from "../s3.service.js";
import {
    validateOrganizationMembership,
    getDocument,
    getActiveDocument,
    getDraftDocument,
    getDeletedDocument,
    getDocumentWithVersions,
} from "./documentHelpers.js";

const DRAFT_EXPIRY_HOURS = 24;

const validClassifications = [
    "GENERAL",
    "INTERNAL",
    "CONFIDENTIAL",
    "RESTRICTED",
];

const validDocumentTransitions = {
    DRAFT:["SUBMITTED","EXPIRED"],
    SUBMITTED:["QUEUED"],
    QUEUED:["PROCESSING"],
    PROCESSING:["READY","FAILED"],
    READY: ["QUEUED", "DELETED"],
};

const isDraftExpired = (document)=>{
    return (
        document.status==="DRAFT" &&
        document.draftExpiresAt &&
        document.draftExpiresAt<=new Date()
    );
};

const expireDraftIfNeeded = async(document)=>{
    if(!isDraftExpired(document)){
        return document;
    }

    return prisma.document.update({
        where:{id:document.id,},
        data:{status:"EXPIRED",},
    });
};

const expireOrganizationDrafts = async(organizationId)=>{
    return prisma.document.updateMany({
        where:{
            organizationId,
            status:"DRAFT",
            draftExpiresAt:{
                lte:new Date(),
            },
        },
        data:{
            status:"EXPIRED",
        },
    });
};

const cleanupDraftUpload = async(tx,document,version)=>{
    await tx.documentVersion.delete({
        where:{id:version.id,},
    });

    await tx.document.update({
        where:{id:document.id,},
        data:{
            currentVersionId:null,
        },
    });
};

const validateDraftForPublication = async(user,documentId)=>{
    const document = await getDraftDocument(
        user,
        documentId
    );

    if(!document.title?.trim()){
        throw new ApiError(
            400,
            "Document title is required"
        );
    }

    if(!validClassifications.includes(document.classification)){
        throw new ApiError(
            400,
            "Invalid document classification."
        );
    }

    if(!document.currentVersionId){
        throw new ApiError(
            400,
            "A draft file must be uploaded before publication"
        );
    }

    const version = await prisma.documentVersion.findUnique({
        where:{
            id:document.currentVersionId,
        },
    });

    if(!version){
        throw new ApiError(
            400,
            "Draft upload not found."
        );
    }

    return {
        document,
        version,
    };
};

export const validateDocumentTransition = (currentStatus,nextStatus)=>{
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

const createInitialDocumentAccessPolicies = async(tx,user,document)=>{
    const actions=[
        "QUERY",
        "VIEW",
        "DOWNLOAD",
        "MANAGE_ACCESS",
    ];

    const policies=[];

    for(const action of actions){
        const policy =
            await tx.documentAccessPolicy.create({
                data:{
                    organizationId:document.organizationId,
                    documentId:document.id,

                    subjectType:"USER",
                    subjectUserId:user.id,

                    action,
                    effect:"ALLOW",

                    grantedById:user.id,
                },
            });

        policies.push(policy);
    }

    return policies;
};

const createInitialDocumentAccessAudit = async(tx,user,policies)=>{
    for(const policy of policies){
        await tx.documentAccessAudit.create({
            data:{
                organizationId:policy.organizationId,
                documentId:policy.documentId,
                policyId:policy.id,

                actorId:user.id,

                subjectType:policy.subjectType,
                subjectOrganizationId:policy.subjectOrganizationId,
                subjectUnitId:policy.subjectUnitId,
                subjectRole:policy.subjectRole,
                subjectUserId:policy.subjectUserId,

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

                reason:"Initial document publication.",
            },
        });
    }
};

export const createDocumentDraft = async(user,documentData)=>{
    const {
        title,
        description,
        classification,
    } = documentData;

    validateOrganizationMembership(user);

    if(!title || !title.trim()){
        throw new ApiError(
            400,
            "Document title is required"
        );
    }

    if(!validClassifications.includes(classification)){
        throw new ApiError(
            400,
            "Invalid document classification"
        );
    }

    const draftExpiresAt = new Date(
        Date.now() +
        DRAFT_EXPIRY_HOURS *
        60 *
        60 *
        1000
    );

    return prisma.document.create({
        data:{
            organizationId:user.unit.organizationId,
            title:title.trim(),
            description:description?.trim() || null,
            classification,
            status:"DRAFT",
            uploadedById:user.id,
            draftExpiresAt,
        },
    });
};

export const expireDocumentDrafts = async(user)=>{
    validateOrganizationMembership(user);

    const result = await expireOrganizationDrafts(
        user.unit.organizationId
    );

    return {
        expiredDocuments:result.count,
    };
};

export const updateDocumentDraft = async(
    user,
    documentId,
    documentData
)=>{
    const {
        title,
        description,
        classification,
    } = documentData;

    await getDraftDocument(
        user,
        documentId
    );

    if(title!==undefined && !title.trim()){
        throw new ApiError(
            400,
            "Document title cannot be empty"
        );
    }

    if(
        classification!==undefined &&
        !validClassifications.includes(classification)
    ){
        throw new ApiError(
            400,
            "Invalid document classification"
        );
    }

    return prisma.document.update({
        where:{id:documentId,},
        data:{
            ...(title!==undefined && {
                title:title.trim(),
            }),

            ...(description!==undefined && {
                description:description?.trim() || null,
            }),

            ...(classification!==undefined && {
                classification,
            }),
        },
    });
};

export const getDocuments = async(user)=>{
    validateOrganizationMembership(user);

    await expireOrganizationDrafts(
        user.unit.organizationId
    );

    return prisma.document.findMany({
        where:{
            organizationId:user.unit.organizationId,
            isDeleted:false,
        },
        orderBy:{
            createdAt:"desc",
        },
    });
};

export const getDocumentById = async(
    user,
    documentId
)=>{
    const document = await getActiveDocument(
        user,
        documentId
    );

    return expireDraftIfNeeded(document);
};

export const uploadDraft = async(
    user,
    documentId,
    file
)=>{
    validateFile(file);

    const document = await getDraftDocument(
        user,
        documentId
    );

    if(document.currentVersionId){
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

    try{

        uploadedObject = await uploadFileToS3(
            file,
            objectKey
        );

        return await prisma.$transaction(async(tx)=>{

            const version =
                await tx.documentVersion.create({
                    data:{
                        id:versionId,
                        documentId,

                        versionNumber:1,

                        storageBucket:uploadedObject.bucket,
                        storageKey:uploadedObject.key,

                        originalFileName:file.originalname,
                        mimeType:file.mimetype,
                        fileSize:file.size,
                        checksum:uploadedObject.checksum,

                        createdById:user.id,
                    },
                });

            await tx.document.update({
                where:{id:documentId,},
                data:{
                    currentVersionId:version.id,
                },
            });

            return version;
        });

    }catch(error){

        if(uploadedObject){
            try{
                await deleteFileFromS3(
                    objectKey
                );
            }catch{}
        }

        throw error;
    }
};

export const deleteDraftUpload = async(
    user,
    documentId
)=>{
    const document = await getDraftDocument(
        user,
        documentId
    );

    if(!document.currentVersionId){
        throw new ApiError(
            404,
            "No uploaded file exists for this draft."
        );
    }

    const version =
        await prisma.documentVersion.findUnique({
            where:{
                id:document.currentVersionId,
            },
        });

    if(!version){
        throw new ApiError(
            404,
            "Uploaded draft version not found."
        );
    }

    await prisma.$transaction(async(tx)=>{
        await cleanupDraftUpload(
            tx,
            document,
            version
        );
    });

    await deleteFileFromS3(
        version.storageKey
    );

    return {
        message:"Draft upload deleted successfully.",
    };
};

export const publishDraft = async(user,documentId)=>{
    const {document} =await validateDraftForPublication(user,documentId);
    validateDocumentTransition(
        document.status,
        "SUBMITTED"
    );

    const publishedDocument = await prisma.$transaction(async(tx)=>{
        const policies =await createInitialDocumentAccessPolicies(tx,user,document);
        await createInitialDocumentAccessAudit(tx,user,policies);
    
        return await tx.document.update({
            where:{ id: document.id },
            data:{
                status:"SUBMITTED",
                submittedAt:new Date(),
            },
        });
    
    });
    await dispatchDocumentProcessing({
        documentId: publishedDocument.id,
        versionId: publishedDocument.currentVersionId,
    });
    return publishedDocument;
};

export const softDeleteDocument = async(
    user,
    documentId
)=>{
    const document = await getActiveDocument(
        user,
        documentId
    );

    return prisma.document.update({
        where:{id:documentId,},
        data:{
            status:"DELETED",
            isDeleted:true,
            deletedAt:new Date(),
            deletedById:user.id,
        },
    });
};

export const restoreDocument = async(
    user,
    documentId
)=>{
    await getDeletedDocument(
        user,
        documentId
    );

    return prisma.document.update({
        where:{id:documentId,},
        data:{
            status:"READY",
            isDeleted:false,
            deletedAt:null,
            deletedById:null,
        },
    });
};

export const cleanupDeletedDocument = async(
    user,
    documentId
)=>{
    const document =
    await getDocumentWithVersions(
        user,
        documentId
    );

    if(!document.isDeleted){
        throw new ApiError(
            400,
            "Document must be deleted before cleanup."
        );
    }

    for(const version of document.versions){
        try{
            await deleteFileFromS3(
                version.storageKey
            );
        }catch{}
    }

    await prisma.$transaction(async(tx)=>{

        await tx.documentAccessAudit.deleteMany({
            where:{documentId,},
        });

        await tx.documentAccessPolicy.deleteMany({
            where:{documentId,},
        });

        await tx.documentVersion.deleteMany({
            where:{documentId,},
        });

        await tx.document.delete({
            where:{id:documentId,},
        });

    });

    return {
        message:"Document cleanup completed successfully.",
    };
};

export const cleanupExpiredDrafts = async(
    user
)=>{
    validateOrganizationMembership(user);

    const drafts =
        await prisma.document.findMany({
            where:{
                organizationId:user.unit.organizationId,
                status:"EXPIRED",
            },
            include:{
                versions:true,
            },
        });

    for(const document of drafts){

        for(const version of document.versions){
            try{
                await deleteFileFromS3(
                    version.storageKey
                );
            }catch{}
        }

        await prisma.$transaction(async(tx)=>{

            await tx.documentVersion.deleteMany({
                where:{
                    documentId:document.id,
                },
            });

            await tx.document.delete({
                where:{
                    id:document.id,
                },
            });

        });

    }

    return {
        cleanedDrafts:drafts.length,
    };
};

export const getDocumentVersions = async(
    user,
    documentId
)=>{
    const document = await getActiveDocument(
        user,
        documentId
    );

    return prisma.documentVersion.findMany({
        where:{documentId,},
        orderBy:{
            versionNumber:"desc",
        },
    });
};

export const getDocumentVersionById = async(
    user,
    documentId,
    versionId
)=>{
    await getActiveDocument(
        user,
        documentId
    );

    const version =
        await prisma.documentVersion.findFirst({
            where:{
                id:versionId,
                documentId,
            },
        });

    if(!version){
        throw new ApiError(
            404,
            "Document version not found."
        );
    }

    return version;
};

export const uploadDocumentVersion = async (
    user,
    documentId,
    file
) => {
    validateFile(file);

    const document = await getActiveDocument(
        user,
        documentId
    );

    if (document.status !== "READY") {
        throw new ApiError(
            400,
            "New versions can only be uploaded for published documents."
        );
    }

    const versionId = randomUUID();

    const objectKey =
        `organizations/${user.unit.organizationId}` +
        `/documents/${documentId}/${versionId}`;

    let uploadedObject = null;

    try {
        uploadedObject = await uploadFileToS3(
            file,
            objectKey
        );

        const version = await prisma.$transaction(async (tx) => {
            const latestVersion =
                await tx.documentVersion.findFirst({
                    where: {
                        documentId,
                    },
                    orderBy: {
                        versionNumber: "desc",
                    },
                });

            const versionNumber =
                latestVersion
                    ? latestVersion.versionNumber + 1
                    : 1;

            const version =
                await tx.documentVersion.create({
                    data: {
                        id: versionId,
                        documentId,

                        versionNumber,

                        storageBucket:
                            uploadedObject.bucket,

                        storageKey:
                            uploadedObject.key,

                        originalFileName:
                            file.originalname,

                        mimeType:
                            file.mimetype,

                        fileSize:
                            file.size,

                        checksum:
                            uploadedObject.checksum,

                        createdById:
                            user.id,
                    },
                });

            await tx.document.update({
                where: {
                    id: documentId,
                },
                data: {
                    currentVersionId: version.id,
                    status: "QUEUED",
                    processingError: null,
                    updatedAt: new Date(),
                },
            });

            return version;
        });

        await dispatchDocumentProcessing({
            documentId,
            versionId: version.id,
        });

        return version;

    } catch (error) {
        if (uploadedObject) {
            try {
                await deleteFileFromS3(
                    objectKey
                );
            } catch {}
        }

        throw error;
    }
};

export const getDocumentDownloadUrl = async(
    user,
    documentId,
    versionId
)=>{
    await authorizeDocumentAction(
        user,
        documentId,
        "DOWNLOAD"
    );

    await getActiveDocument(
        user,
        documentId
    );

    const version =
        await prisma.documentVersion.findFirst({
            where:{
                documentId,
                ...(versionId && {
                    id:versionId,
                }),
            },
            orderBy:{
                versionNumber:"desc",
            },
        });

    if(!version){
        throw new ApiError(
            404,
            "Document version not found."
        );
    }

    const downloadUrl =
        await getDownloadUrlFromS3(
            version.storageKey
        );

    return {
        documentId,
        versionId:version.id,
        versionNumber:
            version.versionNumber,
        fileName:
            version.originalFileName,
        downloadUrl,
    };
};