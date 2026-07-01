// backend/src/routes/organization.routes.js

import {Router} from "express";

import {createOrganization} from "../controllers/organization.controller.js";
import {authenticate} from "../middleware/auth.middleware.js";

const router = Router();

router.post("/",authenticate,createOrganization);

export default router;