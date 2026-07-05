// backend/src/routes/invitation.routes.js

import {Router} from "express";
import {
    createInvitation,
    getInvitations,
    acceptInvitation,
    revokeInvitation,
    getReceivedInvitations
} from "../controllers/invitation.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = Router();

router.get(
    "/",
    authenticate,
    getInvitations
);

router.post(
    "/",
    authenticate,
    createInvitation
);

router.patch(
    "/accept/:token",
    authenticate,
    acceptInvitation
);

router.patch(
    "/:invitationId/revoke",
    authenticate,
    revokeInvitation
);

router.get(
    "/received",
    authenticate,
    getReceivedInvitations
);

export default router;