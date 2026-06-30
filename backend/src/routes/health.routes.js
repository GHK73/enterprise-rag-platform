// backend/src/routes/health.routes.js

import {Router} from 'express';
import healthCheck from '../controllers/health.controller.js';
import auth from "../middleware/auth.middleware.js";

const router = Router();

router.get("/",auth,healthCheck);

export default router;