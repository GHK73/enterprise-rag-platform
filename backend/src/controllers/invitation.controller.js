// backend/src/controllers/invitation.controller.js

import{
    createInvitation as createInvitationService,
    getInvitations as getInvitationsService,
    acceptInvitation as acceptInvitationService,
    revokeInvitation as revokeInvitationService,
    getReceivedInvitations as getReceivedInvitationsService
} from "../services/invitation.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const createInvitation = asyncHandler(async(req,res)=>{
    const {email,unitId,role} = req.body;

    const invitation = await createInvitationService(
        req.user,
        {
            email,
            unitId,
            role
        }
    );

    return res.status(201).json(
        new ApiResponse(201,"Invitation created successfully",invitation)
    );
});

export const getInvitations = asyncHandler(async(req,res)=>{
    const invitations = await getInvitationsService(req.user);

    return res.status(200).json(
        new ApiResponse(200,"Invitations fetched successfully",invitations)
    );
});

export const acceptInvitation = asyncHandler(async(req,res)=>{
    const {token} = req.params;

    const user = await acceptInvitationService(
        req.user,
        token
    );

    return res.status(200).json(
        new ApiResponse(200,"Invitation accepted successfully",user)
    );
});

export const revokeInvitation = asyncHandler(async(req,res)=>{
    const {invitationId} = req.params;

    const invitation = await revokeInvitationService(
        req.user,
        invitationId
    );

    return res.status(200).json(
        new ApiResponse(200,"Invitation revoked successfully",invitation)
    );
});

export const getReceivedInvitations = asyncHandler(async(req,res)=>{
    const invitations = await getReceivedInvitationsService(req.user);

    return res.status(200).json(
        new ApiResponse(200,"Received invitations fetched successfully",invitations)
    );
});

