// backend/src/services/document/documentProcessing.service.js

import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import {
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
    handleProcessingFailure,
} from "./documentAI.service.js";
import { invalidateOrganizationQueryCache } from "../query/queryCache.service.js";

async function updateProcessingStatus(documentId, versionId, status, errorMessage = null) {
    return await prisma.document.updateMany({
        where: {
            id: documentId,
            currentVersionId: versionId,
        },
        data: {
            status,
            processingError: errorMessage,
        },
    });
}

async function markProcessingReady(documentId,versionId){
    return await prisma.document.updateMany({
        where:{
            id:documentId,
            currentVersionId:versionId,
            status:"PROCESSING"
        },
        data:{
            status:"READY",
            processingError:null
        }
    });
}

async function markProcessingFailed(documentId,versionId,error){
    return await prisma.document.updateMany({
        where:{
            id:documentId,
            currentVersionId:versionId,
            status:"PROCESSING"
        },
        data:{
            status:"FAILED",
            processingError:error?.message??"Document processing failed."
        }
    });
}

async function processDocument({ documentId, versionId }) {
    try {
        await updateProcessingStatus(
            documentId,
            versionId,
            "PROCESSING"
        );

        const document = await prisma.document.findUnique({
            where: { id: documentId },
        });

        const version = await prisma.documentVersion.findUnique({
            where: { id: versionId },
        });

        if (!document || !version) {
            throw new ApiError(404, "Document or version not found.");
        }

        const payload = await buildProcessingPayload(document, version);
        const response = await processDocumentWithAI(payload);

        await handleProcessingSuccess(response);

        const readyResult = await markProcessingReady(
            documentId,
            versionId
        );

        if (readyResult.count === 1) {
            await invalidateOrganizationQueryCache(
                document.organizationId
            );
        }
    } catch (error) {
        await handleProcessingFailure(error);
        await markProcessingFailed(
            documentId,
            versionId,
            error
        );
        throw error;
    }
}

export {
    processDocument,
    updateProcessingStatus,
    markProcessingReady,
    markProcessingFailed,
};