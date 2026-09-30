import { Router } from "express";
import { queryDocuments } from "../controllers/query.controller.js";
import authenticate from "../middleware/auth.middleware.js";
import { queryRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post(
    "/",
    authenticate,
    queryRateLimiter,
    queryDocuments
);

export default router;
