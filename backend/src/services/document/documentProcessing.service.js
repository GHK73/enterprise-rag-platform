import prisma from "../../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import {
    buildProcessingPayload,
    processDocumentWithAI,
    handleProcessingSuccess,
} from "./documentAI.service.js";
import { invalidateOrganizationQueryCache } from "../query/queryCache.service.js";
import { dispatchDocumentProcessing } from "./documentProcessingDispatcher.service.js";
import { authorizeDocumentAction } from "./documentAccess.service.js";

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
    return await prisma.$transaction(async (tx) => {
        const documentResult = await tx.document.updateMany({
            where: {
                id: documentId,
                currentVersionId: versionId,
                status: "PROCESSING",
            },
            data: {
                status: "READY",
            },
        });

        if (documentResult.count === 1) {
            await tx.documentVersion.update({
                where: {
                    id: versionId,
                },
                data: {
                    processingStatus: "READY",
                },
            });
        }

        return documentResult;
    });
}

async function markProcessingFailed(documentId, versionId, error) {
    return await prisma.$transaction(async (tx) => {
        const documentResult = await tx.document.updateMany({
            where: {
                id: documentId,
                currentVersionId: versionId,
                status: "PROCESSING",
            },
            data: {
                status: "FAILED",
            },
        });

        if (documentResult.count === 1) {
            await tx.documentVersion.update({
                where: {
                    id: versionId,
                },
                data: {
                    processingStatus: "FAILED",
                },
            });
        }

        return documentResult;
    });
}

async function processDocument({ documentId, versionId }) {
    try {
        const processingResult = await updateProcessingStatus(
            documentId,
            versionId,
            "PROCESSING"
        );

        if (processingResult.count !== 1) {
            throw new ApiError(
                409,
                "Document is not available for processing."
            );
        }

        await prisma.documentVersion.updateMany({
            where: {
                id: versionId,
                documentId,
            },
            data: {
                processingStatus: "PROCESSING",
            },
        });

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
        try {
            await markProcessingFailed(
                documentId,
                versionId,
                error
            );
        } catch (markFailureError) {
            console.error(
                `DOCUMENT PROCESSING: Failed to mark ${documentId} version ${versionId} as FAILED`,
                markFailureError
            );
        }

        throw error;
    }
}

async function reprocessDocument({
    user,
    documentId,
    versionId,
}) {
    const document = await prisma.document.findUnique({
        where: {
            id: documentId,
        },
    });

    if (!document) {
        throw new ApiError(404, "Document not found.");
    }

    await authorizeDocumentAction(
        user,
        documentId,
        "MANAGE_ACCESS"
    );

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

    await prisma.documentVersion.updateMany({
        where: {
            id: versionId,
            documentId,
        },
        data: {
            processingStatus: "QUEUED",
        },
    });

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
