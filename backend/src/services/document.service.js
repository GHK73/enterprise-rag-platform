// bakcend/src/services/document.service.js

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const DRAFT_EXPIRY_HOURS = 24;

const isDraftExpired = (document)=>{
    return(document.status === "DRAFT" && document.draftExpiresAt && document.draftExpiresAt<=new Date());
};

const expireDraftIfNeeded = async(document)=>{
    if(!isDraftExpired(document))return document;
    return prisma.document.update({
        where:{id: document.id},
        data:{status: "EXPIRED"}
    });
};

const expireOrganizationDrafts = async(organizationId)=>{
    return prisma.document.updateMany({
        where:{
            organizationId,
            status: "DRAFT",
            draftExpiresAt:{
                lte: new Date()
            }
        },
        data:{
            status:"EXPIRED"
        }
    });
};

export const createDocumentDraft = async(useImperativeHandle, documentData)=>{
    const {title,description,classification} = documentData;

    if(!title || !title.trim()){
        throw new ApiError(400, "Document title is required");
    }
    const validClassification = [
        "GENERAL",
        "INTERNAL",
        "CONFIDENTIAL",
        "RESTRICTED"
    ];
    if(!validClassifications.includes(classification)){
        throw new ApiError(400,"Invalid document classification");
    }

    const user = await prisma.user.findUnique({
        where:{id: userId},
        include:{unit:true}
    });
    if(!user){
        throw new ApiError(404,"User nor Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(404,"User does not belong to an organization");
    }

    const draftExpiresAt = new Date(Date.now()+ DRAFT_EXPIRY_HOURS*60*60*1000);

    const document = await prisma.document .create({
        data:{
            organizationId: user.unit.organizationId,
            title:title.trim(),
            description: description?.trim() || null,
            classification,
            status: "DRAFT",
            uploadedById:userId,
            draftExpiresAt  
        }
    });
    return document;
}

export const expireDocumentDrafts = async(userId)=>{
    const user = await prisma.user.findUnique({
        where:{id:userId},
        include:{unit:true}
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(404,"User does not belong to an organization");
    }

    const result = await prisma.document.updateMany({
        where:{
            organizationId:user.unit.organizationId,
            status: "DRAFT",
            draftExpiresAT:{
                lte:new Date()
            }
        },
        data:{
            status: "EXPIRED"
        }
    });
    return {expiredDocuments: result.count};
};

export const updateDocumentDraft = async(userId,documentId, documentData)=>{
    const {title,description,classification} = documentData;
    const user = await prisma.user.findUnique({
        where:{id:userId},
        include:{unit: true}
    });
    if(!user){
        throw new ApiError(404,"User does not belong to an organization");
    }
    const document = await prisma.document.findUnique({
        where:{id:documentId}
    });
    if(!document){
        throw new ApiError(404,"Document not Found");
    }
    if(document.organizationId !== user.unit.organizationId){
        throw new ApiError(403,"Document does not belong to your organization");
    }
    if(document.status !=="DRAFT"){
        throw new ApiError(400,"Only draft documents can be updated");
    }
    if(isDraftExpired(document)){
        await expireDraftIfNeeded(document);
        throw new ApiError(400,"Document draft has expired");
    }
    if(title !== undefined && !title.trim()){
        throw new ApiError(400,"Document title cannot be empty");
    }

    const validClassifications = [
        "GENERAL",
        "INTERNAL",
        "CONFIDENTIAL",
        "RESTRICTED"
    ];

    if(classification !== undefined && !validClassifications.includes(classification)){
        throw new ApiError(400,"Invalid document classification");
    }
    return prisma.document.update({
        where:{id: documentId},
        data:{
            ...(title !== undefined &&{title:title.trim()}),
            ...(description !== undefined &&{description:description?.trim() || null}),
            ...(classification !== undefined &&{classification})
        }
    });
};

const validDocumentTransactions = {
    DRAFT:["SUBMITTED","EXPIRED"],
    SUBMITTED:["QUEUD"],
    QUEUED:["PROCESSING"],
    PROCESSING:["READY","FAILED"],
    READY:["DELETED"]
};

export const validateDocumentTransition = (currentStatus, nextStatus)=>{
    const allowedTransitions = validDocumentTransitions[currentStatus] || [];
    if(!allowedTransitions.includes(nextStatus)){
        throw new ApiError(400,`Document cannot transition from ${currentStatus} to ${nextStatus}`);
    }
    return true;
}

export const getDocuments = async(userId)=>{
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

    await expiresOrganizationDrafts(
        user.unit.organizationId 
    );
    
    return prisma.document.findMany({
        where:{
            organizationId: user.unit.organizationId,
            isDeleted: false 
        },
        orderBy:{
            createAt: "desc" 
        }
    });
};

export const getDocumentById = async(userId, documentId)=>{
    const user = await prisma.user.findUnique({
        where:{id:userId},
        include:{unit: true}
    });
    if(!user){
        throw new ApiError(404,"User not Found");
    }
    if(!user.unitId || !user.unit){
        throw new ApiError(404,"User does not belong to an organization");
    }
    const document = await prisma.document.findUnique({
        where:{id: documentId}
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
}
