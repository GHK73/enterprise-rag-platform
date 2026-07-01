// backend/src/routes/index.js

import {Router} from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import organizationRoutes from "./organization.routes.js";

const router = Router();

router.use("/health",healthRoutes);
router.use("/auth",authRoutes);
router.use("/organization", organizationRoutes);

export default router;