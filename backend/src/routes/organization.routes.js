// backend/src/routes/organization.routes.js

import {Router} from "express";
import {
    createOrganization,
    getOrganization,
    updateOrganization,
    createOrganizationUnit,
    getOrganizationUnits,
    updateOrganizationUnit,
    deleteOrganizationUnit,
    getOrganizationMembers
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

router.patch(
    "/units/:unitId",
    authenticate,
    updateOrganizationUnit
);
router.delete(
    "/units/:unitId",
    authenticate,
    deleteOrganizationUnit
);
router.get(
    "/members",
    authenticate,
    getOrganizationMembers
);

export default router;