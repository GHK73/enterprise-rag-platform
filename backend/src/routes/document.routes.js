import { Router } from "express";
import {
    createDocumentDraft,
    updateDocumentDraft,
    getDocuments,
    getDocumentById,
    uploadDraft,
    deleteDraftUpload,
    publishDraft,

    grantDocumentAccess,
    updateDocumentAccessPolicy,
    revokeDocumentAccess,
    getDocumentAccessPolicies,
    getDocumentAccessHistory,
    grantTemporaryDocumentAccess,

    downloadDocument,
    generateDocumentDownloadUrl,

    softDeleteDocument,
    restoreDocument,
    cleanupDeletedDocument,
    cleanupExpiredDrafts,
} from "../controllers/document.controller.js";

import authenticate from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                                Drafts                                      */
/* -------------------------------------------------------------------------- */

router.post(
    "/drafts",
    authenticate,
    createDocumentDraft
);

router.post(
    "/drafts/:documentId/upload",
    authenticate,
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

/* -------------------------------------------------------------------------- */
/*                              Documents                                     */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                           Document Access                                  */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                               Downloads                                    */
/* -------------------------------------------------------------------------- */

router.get(
    "/:documentId/download",
    authenticate,
    downloadDocument
);

router.get(
    "/:documentId/download-url",
    authenticate,
    generateDocumentDownloadUrl
);

export default router;