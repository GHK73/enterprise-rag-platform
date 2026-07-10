import {Router} from "express";
import{
    createDocumentDraft,
    updateDocumentDraft,
    getDocuments,
    getDocumentById 
}from "../controllers/document.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = Router();

router.post("/drafts",authenticate,createDocumentDraft);

router.get("/",authenticate,getDocuments);

router.get("/:documentId",authenticate,getDocumentById);

router.patch("/:documentId",authenticate,updateDocumentDraft);

export default router;