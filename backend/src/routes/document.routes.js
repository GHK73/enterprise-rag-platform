// backend/src/routes/document.routes.js
import { Router } from "express";
import {
    createDocumentDraft,
    updateDocumentDraft,
    getDocuments,
    getDocumentById,

    uploadDraft,
    deleteDraftUpload,
    publishDraft,

    getDocumentVersions,
    getDocumentVersionById,
    uploadDocumentVersion,
    getDocumentDownloadUrl,
    reprocessDocument,

    grantDocumentAccess,
    updateDocumentAccessPolicy,
    revokeDocumentAccess,
    getDocumentAccessPolicies,
    getDocumentAccessPolicyById,
    getDocumentAccessHistory,
    grantTemporaryDocumentAccess,

    softDeleteDocument,
    restoreDocument,
    cleanupDeletedDocument,
    cleanupExpiredDrafts,
} from "../controllers/document.controllers.js";

import authenticate from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";
import {
    documentUploadRateLimiter,
} from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post(
    "/drafts",
    authenticate,
    createDocumentDraft
);

router.post(
    "/drafts/:documentId/upload",
    authenticate,
    documentUploadRateLimiter,
    upload.single("file"),
    uploadDraft
);

router.delete(
    "/drafts/:documentId/upload",
    authenticate,
    deleteDraftUpload
);

router.post(
    "/drafts/:documentId/publish",
    authenticate,
    publishDraft
);

router.post(
    "/cleanup/expired-drafts",
    authenticate,
    cleanupExpiredDrafts
);

router.get(
    "/",
    authenticate,
    getDocuments
);

router.get(
    "/:documentId",
    authenticate,
    getDocumentById
);

router.patch(
    "/:documentId",
    authenticate,
    updateDocumentDraft
);

router.delete(
    "/:documentId",
    authenticate,
    softDeleteDocument
);

router.patch(
    "/:documentId/restore",
    authenticate,
    restoreDocument
);

router.delete(
    "/:documentId/cleanup",
    authenticate,
    cleanupDeletedDocument
);

router.get(
    "/:documentId/versions",
    authenticate,
    getDocumentVersions
);

router.post(
    "/:documentId/versions/:versionId/reprocess",
    authenticate,
    reprocessDocument
);

router.get(
    "/:documentId/versions/:versionId",
    authenticate,
    getDocumentVersionById
);

router.post(
    "/:documentId/versions",
    authenticate,
    documentUploadRateLimiter,
    upload.single("file"),
    uploadDocumentVersion
);

router.get(
    "/:documentId/download",
    authenticate,
    getDocumentDownloadUrl
);

router.get(
    "/:documentId/versions/:versionId/download",
    authenticate,
    getDocumentDownloadUrl
);

router.post(
    "/:documentId/access",
    authenticate,
    grantDocumentAccess
);

router.post(
    "/:documentId/access/temporary",
    authenticate,
    grantTemporaryDocumentAccess
);

router.get(
    "/:documentId/access",
    authenticate,
    getDocumentAccessPolicies
);

router.get(
    "/:documentId/access/history",
    authenticate,
    getDocumentAccessHistory
);

router.get(
    "/access/:policyId",
    authenticate,
    getDocumentAccessPolicyById
);

router.patch(
    "/access/:policyId",
    authenticate,
    updateDocumentAccessPolicy
);

router.delete(
    "/access/:policyId",
    authenticate,
    revokeDocumentAccess
);

export default router;
