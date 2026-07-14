import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

export const DRAFT_EXPIRY_HOURS = 24;

export const validClassifications = [
    "GENERAL",
    "INTERNAL",
    "CONFIDENTIAL",
    "RESTRICTED",
];

export const validDocumentTransitions = {
    DRAFT:["SUBMITTED","EXPIRED"],
    SUBMITTED:["QUEUED"],
    QUEUED:["PROCESSING"],
    PROCESSING:["READY","FAILED"],
    READY:["DELETED"],
};

export const validateOrganizationMembership = (user)=>{
    if(!user.unitId || !user.unit){
        throw new ApiError(403,"User does not belong to an organization");
    }
};

export const getDocument = async(user,documentId)=>{
    validateOrganizationMembership(user);

    const document = await prisma.document.findUnique({
        where:{id:documentId,},
    });

    if(!document){
        throw new ApiError(404,"Document not found.");
    }

    if(document.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Document does not belong to your organization.");
    }

    return document;
};

export const getActiveDocument = async(user,documentId)=>{
    const document = await getDocument(user,documentId);

    if(document.isDeleted){
        throw new ApiError(404,"Document not found.");
    }

    return document;
};

export const isDraftExpired = (document)=>{
    return (
        document.status === "DRAFT" &&
        document.draftExpiresAt &&
        document.draftExpiresAt <= new Date()
    );
};

export const expireDraftIfNeeded = async(document)=>{
    if(!isDraftExpired(document)){
        return document;
    }

    return prisma.document.update({
        where:{id:document.id,},
        data:{status:"EXPIRED",},
    });
};

export const expireOrganizationDrafts = async(organizationId)=>{
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

export const getDraftDocument = async(user,documentId)=>{
    const document = await getActiveDocument(user,documentId);

    if(document.status !== "DRAFT"){
        throw new ApiError(400,"Only draft documents can be modified");
    }

    if(isDraftExpired(document)){
        await expireDraftIfNeeded(document);

        throw new ApiError(400,"Document draft has expired");
    }

    return document;
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

export const cleanupDraftUpload = async(tx,document,version)=>{
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

export const getDocumentAccessPolicy = async(user,policyId)=>{
    validateOrganizationMembership(user);

    const policy =
        await prisma.documentAccessPolicy.findUnique({
            where:{id:policyId,},
            include:{
                document:true,
            },
        });

    if(!policy){
        throw new ApiError(
            404,
            "Access policy not found."
        );
    }

    if(
        policy.document.organizationId !==
        user.unit.organizationId
    ){
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    return policy;
};

export const getDeletedDocument = async(user,documentId)=>{
    const document = await getDocument(
        user,
        documentId
    );

    if(!document.isDeleted){
        throw new ApiError(
            400,
            "Document is not deleted."
        );
    }

    return document;
};

export const getDocumentWithVersions = async(user,documentId)=>{
    validateOrganizationMembership(user);

    const document =
        await prisma.document.findUnique({
            where:{id:documentId,},
            include:{
                versions:true,
            },
        });

    if(!document){
        throw new ApiError(
            404,
            "Document not found."
        );
    }

    if(document.organizationId !== user.unit.organizationId){
        throw new ApiError(
            403,
            "Document does not belong to your organization."
        );
    }

    return document;
};