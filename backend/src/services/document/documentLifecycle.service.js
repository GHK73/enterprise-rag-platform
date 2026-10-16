// backend/src/services/document/documentLifecycle.service.js

import { randomUUID } from "crypto";

import config from "../../config/config.js";
import prisma from "../../config/prisma.js";

import { dispatchDocumentProcessing } from "./documentProcessingDispatcher.service.js";
import { documentProcessingQueue } from "../../config/bullmq.js";

import ApiError from "../../utils/ApiError.js";

import { validateFile } from "../../utils/fileValidation.js";

import { uploadFileToS3, deleteFileFromS3, getDownloadUrlFromS3 } from "../s3.service.js";
import { deleteDocumentVectors } from "../../config/ai.js";

import { redisClient } from "../../config/redis.js";

import {
    DRAFT_EXPIRY_HOURS,
    STALE_PROCESSING_DOCUMENT_MS,
    validClassifications,
    validateDocumentTransition,
    validateOrganizationMembership,
    isDraftExpired,
    expireDraftIfNeeded,
    expireOrganizationDrafts,
    cleanupDraftUpload,
    getActiveDocument,
    getDraftDocument,
    getDeletedDocument,
    getDocumentWithVersions,
} from "./documentHelpers.js";

import {
    authorizeDocumentAction,
    authorizeDocumentsForAction,
} from "./documentAccess.service.js";

const authorizeDraftOwner = (user,document)=>{
    if(document.uploadedById!==user.id){
        throw new ApiError(403,"You do not have permission to modify this document draft.");
    }
    return document;
};

export const recoverStaleProcessingDocuments = async () => {
    const staleBefore = new Date(
        Date.now() - STALE_PROCESSING_DOCUMENT_MS
    );
    const staleDocuments = await prisma.document.findMany({
        where: {
            status: "PROCESSING",
            isDeleted: false,
            updatedAt: {
                lte: staleBefore,
            },
            currentVersionId: {
                not: null,
            },
        },
        select: {
            id: true,
            currentVersionId: true,
        },
    });

    if (staleDocuments.length === 0) {
        return { staleDocuments: 0, recoveredDocuments: 0 };
    }

    const activeJobs = config.redis.enabled
        ? await documentProcessingQueue.getJobs(["active"], 0, -1)
        : [];

    let recoveredDocuments = 0;

    for (const document of staleDocuments) {
        const lockKey = `processing-recovery:lock:${document.id}`;
        let lockAcquired = false;

        if (redisClient) {
            try {
                lockAcquired = await redisClient.set(
                    lockKey,
                    "1",
                    "NX",
                    "EX",
                    300
                );
            } catch (error) {
                console.error(
                    `PROCESSING RECOVERY: Failed to acquire lock for ${document.id}:`,
                    error.message
                );
                continue;
            }
        } else {
            lockAcquired = true;
        }

        if (!lockAcquired) {
            continue;
        }

        try {
            const hasActiveJob = activeJobs.some(
                (job) =>
                    job.data.documentId === document.id &&
                    job.data.versionId === document.currentVersionId
            );

            if (hasActiveJob) {
                continue;
            }

            const transition = await prisma.$transaction(async (tx) => {
                const documentResult = await tx.document.updateMany({
                    where: {
                        id: document.id,
                        currentVersionId: document.currentVersionId,
                        status: "PROCESSING",
                        updatedAt: {
                            lte: staleBefore,
                        },
                    },
                    data: {
                        status: "QUEUED",
                        updatedAt: new Date(),
                    },
                });

                if (documentResult.count === 1) {
                    await tx.documentVersion.updateMany({
                        where: {
                            id: document.currentVersionId,
                            documentId: document.id,
                        },
                        data: {
                            processingStatus: "QUEUED",
                            processingError: null,
                        },
                    });
                }

                return documentResult;
            });

            if (transition.count !== 1) {
                continue;
            }

            try {
                await dispatchDocumentProcessing({
                    documentId: document.id,
                    versionId: document.currentVersionId,
                });
                recoveredDocuments += 1;
                console.warn(
                    `PROCESSING RECOVERY: Re-dispatched stale document ${document.id}`
                );
            } catch (error) {
                await prisma.$transaction(async (tx) => {
                    const failed = await tx.document.updateMany({
                        where: {
                            id: document.id,
                            currentVersionId: document.currentVersionId,
                            status: "QUEUED",
                        },
                        data: {
                            status: "FAILED",
                        },
                    });

                    if (failed.count === 1) {
                        await tx.documentVersion.updateMany({
                            where: {
                                id: document.currentVersionId,
                                documentId: document.id,
                            },
                            data: {
                                processingStatus: "FAILED",
                                processingError: error.message,
                            },
                        });
                    }
                });

                console.error(
                    `PROCESSING RECOVERY: Failed to dispatch document ${document.id}:`,
                    error.message
                );
            }
        } finally {
            if (redisClient) {
                try {
                    await redisClient.del(lockKey);
                } catch (error) {
                    console.error(
                        `PROCESSING RECOVERY: Failed to release lock for ${document.id}:`,
                        error.message
                    );
                }
            }
        }
    }

    return {
        staleDocuments: staleDocuments.length,
        recoveredDocuments,
    };
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

/*
 * Transition validation for this module comes from the
 * authoritative state machine in documentHelpers.js.
 */

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

    /*
     * Access-management authority must not be limited to the
     * uploader. DocumentAccessPolicy.documentId is required, so a
     * tenant-wide policy cannot exist without a migration; seeding
     * ADMINISTRATIVE roles per document at publish time is the
     * equivalent, and gives every published document at least one
     * non-uploader who can delegate, grant, and revoke.
     */
    const managingRoles=[
        "OWNER",
        "ADMIN",
    ];
    for(const subjectRole of managingRoles){
        const policy =
            await tx.documentAccessPolicy.create({
                data:{
                    organizationId:document.organizationId,
                    documentId:document.id,
                    subjectType:"ROLE",
                    subjectRole,
                    action:"MANAGE_ACCESS",
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
        Date.now() +DRAFT_EXPIRY_HOURS *60*60 *1000
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

export const updateDocumentDraft = async(user,documentId,documentData)=>{
    const {title,description,classification} = documentData;
    const document = await getDraftDocument(user,documentId);
    authorizeDraftOwner(user,document);
    if(title!==undefined && !title.trim()) throw new ApiError(400,"Document title cannot be empty");
    if(classification!==undefined && !validClassifications.includes(classification)) throw new ApiError(400,"Invalid document classification");
    return prisma.document.update({where:{id:documentId,},data:{
        ...(title!==undefined && {title:title.trim(),}),
        ...(description!==undefined && {description:description?.trim() || null,}),
        ...(classification!==undefined && {classification,}),
    },});
};

export const getDocuments = async(user)=>{
    validateOrganizationMembership(user);
    await expireOrganizationDrafts(user.unit.organizationId);
    const documents = await prisma.document.findMany({where:{organizationId:user.unit.organizationId,isDeleted:false,status:{not:"EXPIRED"},},orderBy:{createdAt:"desc",},});

    /*
     * Batched authorization: one policy query and one
     * unit-hierarchy walk for the whole listing,
     * instead of one authorizeDocumentAction call
     * (two queries each) per non-draft document.
     */
    const nonDraftDocumentIds = documents
        .filter((document) => document.status !== "DRAFT")
        .map((document) => document.id);

    const viewDecisions = await authorizeDocumentsForAction(
        user,
        nonDraftDocumentIds,
        "VIEW"
    );

    const visibleDocuments=[];
    for(const document of documents){
        if(document.status==="DRAFT"){
            if(document.uploadedById===user.id) visibleDocuments.push(document);
            continue;
        }
        if(viewDecisions.get(document.id)){
            visibleDocuments.push(document);
        }
    }
    return visibleDocuments;
};

export const getDocumentById = async(user,documentId)=>{
    const document = await getActiveDocument(user,documentId);
    const activeDocument = await expireDraftIfNeeded(document);
    if(activeDocument.status==="DRAFT"){
        authorizeDraftOwner(user,activeDocument);
        return activeDocument;
    }
    await authorizeDocumentAction(user,documentId,"VIEW");
    return activeDocument;
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
    authorizeDraftOwner(user,document);
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
                    objectKey,
                    uploadedObject.bucket
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
    authorizeDraftOwner(user,document);
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
        version.storageKey,
        version.storageBucket
    );
    return {
        message:"Draft upload deleted successfully.",
    };
};

export const publishDraft = async(user,documentId)=>{
    let document;
    try{
        ({document} =await validateDraftForPublication(user,documentId));
    }catch(validationError){
        /*
         * A retry after a successful publication is
         * idempotent: when the caller owns the document
         * and it is already SUBMITTED, return the
         * published document instead of an error.
         */
        if(validationError.statusCode === 400){
            const published = await prisma.document.findUnique({
                where:{id:documentId},
            });
            if(
                published &&
                published.status === "SUBMITTED" &&
                published.organizationId ===
                    user.unit.organizationId &&
                published.uploadedById === user.id
            ){
                return published;
            }
        }
        throw validationError;
    }
    authorizeDraftOwner(user,document);
    validateDocumentTransition(
        document.status,
        "SUBMITTED"
    );

    /*
     * The guarded status transition is the atomic
     * publication primitive. updateMany takes a row
     * lock, so concurrent publishes of the same draft
     * serialize: only the request whose update matches
     * creates the initial policies and audit records.
     * Concurrent or retried publication therefore
     * cannot produce duplicate ALLOW policies or
     * duplicate CREATED audit rows.
     */
    const publication = await prisma.$transaction(async(tx)=>{
        const transition = await tx.document.updateMany({
            where:{
                id:document.id,
                status:"DRAFT",
            },
            data:{
                status:"SUBMITTED",
                submittedAt:new Date(),
            },
        });
        if(transition.count !== 1){
            return {published:false};
        }
        const policies =await createInitialDocumentAccessPolicies(tx,user,document);
        await createInitialDocumentAccessAudit(tx,user,policies);
        return {published:true};
    });

    if(!publication.published){
        const currentDocument = await prisma.document.findUnique({
            where:{id:document.id},
        });
        if(currentDocument?.status === "SUBMITTED"){
            return currentDocument;
        }
        throw new ApiError(
            409,
            "Document is no longer a draft."
        );
    }

    /*
     * Dispatch runs after the commit. If dispatch
     * fails, the document must not be stranded in
     * SUBMITTED, which has no recovery path: the
     * guarded transition below moves it to FAILED,
     * from which reprocessDocument re-dispatches
     * processing. The guard on currentVersionId
     * ensures a version uploaded after publication
     * cannot be marked failed by this path.
     */
    try{
        await dispatchDocumentProcessing({
            documentId:document.id,
            versionId:document.currentVersionId,
        });
    }catch(dispatchError){
        try{
            await prisma.$transaction(async(tx)=>{
                const transition = await tx.document.updateMany({
                    where:{
                        id:document.id,
                        status:"SUBMITTED",
                        currentVersionId:document.currentVersionId,
                    },
                    data:{status:"FAILED",},
                });
                if(transition.count === 1){
                    await tx.documentVersion.updateMany({
                        where:{
                            id:document.currentVersionId,
                            documentId:document.id,
                        },
                        data:{processingStatus:"FAILED",},
                    });
                }
            });
        }catch(markFailedError){
            console.error(
                `DOCUMENT PUBLISH: Failed to mark ${document.id} FAILED after dispatch failure`,
                markFailedError.message
            );
        }
        throw dispatchError;
    }

    return prisma.document.findUnique({
        where:{id:document.id},
    });
};

export const softDeleteDocument = async(user,documentId)=>{
    const document = await getActiveDocument(user,documentId);
    if(document.uploadedById!==user.id) throw new ApiError(403,"You do not have permission to delete this document.");
    validateDocumentTransition(document.status,"DELETED");
    return prisma.document.update({where:{id:documentId,},data:{status:"DELETED",isDeleted:true,deletedAt:new Date(),deletedById:user.id,},});
};

export const restoreDocument = async(user,documentId)=>{
    const document = await getDeletedDocument(user,documentId);
    if(document.uploadedById!==user.id) throw new ApiError(403,"You do not have permission to restore this document.");
    if(!document.currentVersionId) throw new ApiError(400,"Document has no current version.");
    const currentVersion = await prisma.documentVersion.findUnique({where:{id:document.currentVersionId,},});
    if(!currentVersion) throw new ApiError(400,"Document current version not found.");
    /*
     * Only a version that was successfully processed
     * and indexed may be restored straight into the
     * retrieval path. A version that never completed
     * processing is restored to FAILED so
     * reprocessDocument rebuilds it before the
     * document becomes retrievable again.
     */
    const restoreStatus =
        currentVersion.processingStatus === "COMPLETED"
            ? "READY"
            : "FAILED";

    validateDocumentTransition(
        "DELETED",
        restoreStatus
    );

    return prisma.document.update({where:{id:documentId,},data:{status:restoreStatus,isDeleted:false,deletedAt:null,deletedById:null,},});
};

/*
 * Crash recovery for publication.
 *
 * publishDraft commits the SUBMITTED transition and then
 * dispatches processing outside the transaction. If the
 * process dies in between, the document rests in SUBMITTED
 * with no job queued, and no request-driven path can
 * recover it (getDraftDocument rejects SUBMITTED and
 * reprocessDocument requires FAILED).
 *
 * SUBMITTED is a transient state — no document should rest
 * in it — so any SUBMITTED document found at startup is
 * stranded and is re-dispatched. The guarded PROCESSING
 * write in processDocument makes a redundant dispatch a
 * 409 no-op, so reconciling a document that another
 * instance is already dispatching is harmless.
 * 
 * Redis lock prevents duplicate re-dispatches across multiple instances.
 */
export const recoverStrandedPublications = async () => {
    const stranded = await prisma.document.findMany({
        where: {
            status: "SUBMITTED",
            isDeleted: false,
        },
        select: {
            id: true,
            currentVersionId: true,
        },
    });

    let recovered = 0;

    for (const document of stranded) {
        if (!document.currentVersionId) {
            continue;
        }

        // Try to acquire lock for this document to prevent duplicate re-dispatches
        const lockKey = `recovery:lock:${document.id}`;
        let lockAcquired = false;

        if (redisClient) {
            try {
                lockAcquired = await redisClient.set(lockKey, "1", "NX", "EX", 300); // 5 min TTL
            } catch (error) {
                console.error(`RECOVERY LOCK: Failed to acquire lock for ${document.id}:`, error.message);
            }
        } else {
            lockAcquired = true; // No Redis, proceed without lock
        }

        if (!lockAcquired) {
            console.log(`DOCUMENT RECOVERY: Skipping ${document.id} - already being recovered by another instance`);
            continue;
        }

        try {
            await dispatchDocumentProcessing({
                documentId: document.id,
                versionId: document.currentVersionId,
            });
            recovered += 1;
            console.log(
                `DOCUMENT RECOVERY: re-dispatched stranded publication ${document.id}`
            );
        } catch (error) {
            console.error(
                `DOCUMENT RECOVERY: failed to re-dispatch stranded publication ${document.id}:`,
                error.message
            );
        } finally {
            if (redisClient) {
                try {
                    await redisClient.del(lockKey);
                } catch (error) {
                    console.error(`RECOVERY LOCK: Failed to release lock for ${document.id}:`, error.message);
                }
            }
        }
    }

    return {
        strandedDocuments: stranded.length,
        recoveredDocuments: recovered,
    };
};

export const cleanupDeletedDocument = async (user, documentId) => {
    const document = await getDocumentWithVersions(user, documentId);
    if (!document.isDeleted) throw new ApiError(400, "Document must be deleted before cleanup.");
    if (document.uploadedById !== user.id) throw new ApiError(403, "You do not have permission to permanently delete this document.");

    const organizationId = document.organizationId;

    for (const version of document.versions) {
        try {
            await deleteFileFromS3(
                version.storageKey,
                version.storageBucket
            );
        } catch (error) {
            console.error(
                `DOCUMENT CLEANUP: Failed to delete S3 object ${version.storageKey}`,
                error.message
            );
        }
    }

    // Delete vectors from Qdrant via AI service
    try {
        await deleteDocumentVectors(organizationId, documentId);
    } catch (error) {
        console.error(
            `DOCUMENT CLEANUP: Failed to delete Qdrant vectors for document ${documentId}`,
            error.message
        );
    }

    await prisma.$transaction(async (tx) => {
        await tx.documentAccessAudit.deleteMany({ where: { documentId } });
        await tx.documentAccessPolicy.deleteMany({ where: { documentId } });
        await tx.document.update({ where: { id: documentId }, data: { currentVersionId: null } });
        await tx.documentVersion.deleteMany({ where: { documentId } });
        await tx.document.delete({ where: { id: documentId } });
    });

    return { message: "Document cleanup completed successfully." };
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
                version.storageKey,
                version.storageBucket
            );
        }catch(error){
            console.error(
                `DOCUMENT CLEANUP: Failed to delete S3 object ${version.storageKey}`,
                error.message
            );
        }
    }
    await prisma.$transaction(async(tx)=>{
            await tx.document.update({
                where:{
                    id:document.id,
                },
                data:{
                    currentVersionId:null,
                },
            });
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

export const getDocumentVersions = async(user,documentId)=>{
    const document = await getActiveDocument(user,documentId);
    if(document.status==="DRAFT") authorizeDraftOwner(user,document);
    else await authorizeDocumentAction(user,documentId,"VIEW");
    return prisma.documentVersion.findMany({where:{documentId,},orderBy:{versionNumber:"desc",},});
};

export const getDocumentVersionById = async(user,documentId,versionId)=>{
    const document = await getActiveDocument(user,documentId);
    if(document.status==="DRAFT") authorizeDraftOwner(user,document);
    else await authorizeDocumentAction(user,documentId,"VIEW");
    const version = await prisma.documentVersion.findFirst({where:{id:versionId,documentId,},});
    if(!version) throw new ApiError(404,"Document version not found.");
    return version;
};

export const uploadDocumentVersion = async(user,documentId,file)=>{
    validateFile(file);
    const document = await getActiveDocument(user,documentId);
    await authorizeDocumentAction(user,documentId,"MANAGE_ACCESS");
    if(document.status!=="READY") throw new ApiError(400,"New versions can only be uploaded for published documents.");
    validateDocumentTransition(document.status,"QUEUED");
    const versionId=randomUUID();
    const objectKey=`organizations/${user.unit.organizationId}/documents/${documentId}/${versionId}`;
    let version;
    let uploadCommitted=false;
    try{
        const uploadedObject=await uploadFileToS3(file,objectKey);
        version=await prisma.$transaction(async(tx)=>{
            const latestVersion=await tx.documentVersion.findFirst({where:{documentId,},orderBy:{versionNumber:"desc",},});
            const versionNumber=latestVersion?latestVersion.versionNumber+1:1;
            const version=await tx.documentVersion.create({data:{id:versionId,documentId,versionNumber,storageBucket:uploadedObject.bucket,storageKey:uploadedObject.key,originalFileName:file.originalname,mimeType:file.mimetype,fileSize:file.size,checksum:uploadedObject.checksum,createdById:user.id,},});
            await tx.document.update({where:{id:documentId,},data:{currentVersionId:version.id,status:"QUEUED",updatedAt:new Date(),},});
            return version;
        });
        uploadCommitted=true;
    }catch(error){
        if(uploadCommitted===false){try{await deleteFileFromS3(objectKey,uploadedObject.bucket);}catch{}}
        throw error;
    }
    try{
        await dispatchDocumentProcessing({documentId,versionId:version.id,});
    }catch(dispatchError){
        try{
            await prisma.$transaction(async(tx)=>{
                const documentResult=await tx.document.updateMany({
                    where:{
                        id:documentId,
                        currentVersionId:version.id,
                        status:"QUEUED",
                    },
                    data:{status:"FAILED",},
                });
                if(documentResult.count===1){
                    await tx.documentVersion.updateMany({
                        where:{ id:version.id, documentId, },
                        data:{ processingStatus:"FAILED", },
                    });
                }
            });
        }catch(markFailedError){
            console.error(
                `DOCUMENT VERSION: Failed to mark ${documentId} version ${version.id} as FAILED after dispatch failure`,
                markFailedError
            );
        }
        throw dispatchError;
    }
    return version;
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
            version.storageKey,
            version.storageBucket
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
