// backend/src/services/document/documentProcessing.service.js

import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import {
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
    handleProcessingFailure,
} from "./documentAI.service.js";

async function updateProcessingStatus(documentId,status,errorMessage = null) {
    return await prisma.document.update({
        where: {id: documentId,},
        data: {
            status,
            processingError: errorMessage,
        },
    });
}

async function markProcessingReady(documentId) {
    return await updateProcessingStatus(documentId,"READY");
}

async function markProcessingFailed(documentId,error) {
    return await updateProcessingStatus(documentId,"FAILED",error?.message ?? "Document processing failed.");
}

async function processDocument({documentId,versionId,}) {
    try {
        await updateProcessingStatus(documentId,"PROCESSING");

        const document =await prisma.document.findUnique({
                where: {id: documentId,},
            });

        const version =await prisma.documentVersion.findUnique({
                where: {id: versionId,},
            });

        if (!document || !version) {
            throw new ApiError(404,"Document or version not found.");
        }

        const payload =await buildProcessingPayload({
                document,
                version,
            });

        const response =await processDocumentWithAI(payload);
        await handleProcessingSuccess(response);
        await markProcessingReady(documentId);
    } catch (error) {
        await handleProcessingFailure(error);
        await markProcessingFailed(
            documentId,
            error
        );
        throw error;
    }
}

export {processDocument,updateProcessingStatus,markProcessingReady,markProcessingFailed,};