import { Router } from "express";
import { queryDocuments } from "../controllers/query.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post(
    "/",
    authenticate,
    queryDocuments
);

export default router;