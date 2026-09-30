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
import { dispatchDocumentProcessing } from "./documentProcessingDispatcher.service.js";

async function updateProcessingStatus(documentId, versionId, status) {
    return await prisma.document.updateMany({
        where: {
            id: documentId,
            currentVersionId: versionId,
        },
        data: {
            status,
        },
    });
}

async function markProcessingReady(documentId, versionId) {
    return await prisma.document.updateMany({
        where: {
            id: documentId,
            currentVersionId: versionId,
            status: "PROCESSING",
        },
        data: {
            status: "READY",
        },
    });
}

async function markProcessingFailed(documentId, versionId, error) {
    return await prisma.document.updateMany({
        where: {
            id: documentId,
            currentVersionId: versionId,
            status: "PROCESSING",
        },
        data: {
            status: "FAILED",
        },
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

async function reprocessDocument({ documentId, versionId }) {
    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(404, "Document not found.");
    }

    if (document.status !== "FAILED") {
        throw new ApiError(
            400,
            "Only failed documents can be reprocessed."
        );
    }

    if (document.currentVersionId !== versionId) {
        throw new ApiError(
            400,
            "The specified version is not the current document version."
        );
    }

    await updateProcessingStatus(
        documentId,
        versionId,
        "QUEUED"
    );

    return await dispatchDocumentProcessing({
        documentId,
        versionId,
    });
}

export {
    processDocument,
    reprocessDocument,
    updateProcessingStatus,
    markProcessingReady,
    markProcessingFailed,
};