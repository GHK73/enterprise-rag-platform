// backend/src/routes/permission.routes.js

import {Router} from "express";
import {
    getUserPermissions,
    getMemberPermissionHistory,
    grantPermission,
    revokePermission
} from "../controllers/permission.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = Router();

router.get(
    "/me",
    authenticate,
    getUserPermissions
);

router.get(
    "/members/:memberId",
    authenticate,
    getMemberPermissionHistory
);

router.post(
    "/",
    authenticate,
    grantPermission
);

router.patch(
    "/:permissionGrantId/revoke",
    authenticate,
    revokePermission
);

export default router;