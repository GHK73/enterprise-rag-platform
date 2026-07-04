// backend/src/routes/organization.routes.js

import {Router} from "express";
import {
    createOrganization,
    getOrganization,
    updateOrganization,
    createOrganizationUnit,
    getOrganizationUnits
} from "../controllers/organization.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = Router();

router.get("/",authenticate,getOrganization);
router.post("/",authenticate,createOrganization);
router.patch("/",authenticate,updateOrganization);

router.get(
    "/units",
    authenticate,
    getOrganizationUnits
);

router.post(
    "/units",
    authenticate,
    createOrganizationUnit
);

export default router;