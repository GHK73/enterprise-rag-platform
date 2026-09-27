import { Router } from "express";
import {
    getUserQueryHistory,
} from "../controllers/query/queryHistory.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = Router();

router.get(
    "/",
    authenticate,
    getUserQueryHistory
);

export default router;