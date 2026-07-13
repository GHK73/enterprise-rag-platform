import {Router} from "express";
import{
    createDocumentDraft,
    updateDocumentDraft,
    getDocuments,
    getDocumentById,
    uploadDraft,
}from "../controllers/document.controller.js";
import authenticate from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = Router();

router.post("/drafts",authenticate,createDocumentDraft);

router.post("/drafts/:documentId/upload",authenticate,upload.single("file"),uploadDraft);

router.patch("/:documentId",authenticate,updateDocumentDraft);

router.get("/",authenticate,getDocuments);

router.get("/:documentId",authenticate,getDocumentById);

export default router;