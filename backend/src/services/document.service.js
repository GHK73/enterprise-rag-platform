// backend/src/services/document.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import {randomUUID} from "crypto";
import {validateFile} from "../utils/fileValidation.js";
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

    const existingVersion = await prisma.documentVersion.findFirst({
        where: {
            documentId,
        },
    });

    if (existingVersion) {
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

export const deleteDraftUpload = async(user, documentId)=>{
    validateOrganizationMembership(user);
    const document = await getDraftDocument(user, documentId);

    const version = await prisma.documentVersion.findFirst({
        where:{documentId,},
    });
    if(!version){
        throw new ApiError(404,"NO uploaded file exists for this draft");
    }
    try{
        await deleteFileFromS3(version.storageKey);
        await prisma.$transaction(async(tx)=>{
            await tx.documentVersion.delete({
                where:{id: version.id,},
            });
            await tx.document.update({
                where:{id: document.id,},
                data:{currentVersionId: null,},
            });
        });
        return {message:"Draft upload deleted successfully",};
    }catch(error){
        throw error;
    }
};