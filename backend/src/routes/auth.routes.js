// backend/src/routes/auth.routes.js

import { Router } from "express";

import {
    register,
    login,
    getCurrentUser,
} from "../controllers/auth.controller.js";

import authenticate from "../middleware/auth.middleware.js";

import {
    loginRateLimiter,
} from "../middleware/loginRateLimit.middleware.js";

const router = Router();

router.post(
    "/register",
    register
);

router.post(
    "/login",
    loginRateLimiter,
    login
);

router.get(
    "/me",
    authenticate,
    getCurrentUser
);

export default router;