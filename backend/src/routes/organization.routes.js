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
    getOrganizationMembers,
    getUnitCapacityController,
    updateUnitCapacityController,
    updateMemberRole,
    moveMember,
    removeMember,
    moveOrganizationUnit,
    getOrganizationRevision
} from "../controllers/organization.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = Router();

router.get("/",authenticate,getOrganization);
router.post("/",authenticate,createOrganization);
router.patch("/",authenticate,updateOrganization);

router.get(
    "/revision",
    authenticate,
    getOrganizationRevision
);

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

router.get(
    "/members",
    authenticate,
    getOrganizationMembers
);

router.get(
    "/units/:unitId/capacity",
    authenticate,
    getUnitCapacityController
);

router.patch(
    "/members/:memberId/role",
    authenticate,
    updateMemberRole
);

router.patch(
    "/members/:memberId/unit",
    authenticate,
    moveMember
);

router.patch(
    "/units/:unitId/move",
    authenticate,
    moveOrganizationUnit
);

router.patch(
    "/units/:unitId/capacity",
    authenticate,
    updateUnitCapacityController
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

router.delete(
    "/members/:memberId",
    authenticate,
    removeMember
);


export default router;