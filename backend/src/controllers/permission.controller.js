// backend/src/controllers/permission.controller.js

import {
    getUserPermissions as getUserPermissionsService,
    getMemberPermissionHistory as getMemberPermissionHistoryService,
    grantPermission as grantPermissionService,
    revokePermission as revokePermissionService
} from "../services/permission.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const getUserPermissions = asyncHandler(async(req,res)=>{
    const permissionGrants = await getUserPermissionsService(req.user.id);
    return res.status(200).json(
        new ApiResponse(200,"User permissions fetched Successfully",permissionGrants)
    );
});

export const getMemberPermissionHistory = asyncHandler(async(req,res)=>{
    const {memberId} = req.params;
    const permissionGrants = await getMemberPermissionHistoryService(req.user.id, memberId);
    return res.status(200).json(
        new ApiResponse(
            200,
            "Member permission history fetched successfully",
            permissionGrants 
        )
    );
});

export const grantPermission = asyncHandler(async(req,res)=>{
    const {recipientId, permission, scopeUnitId, canDelegate} = req.body;
    const permissionGrant = await grantPermissionService(
        req.user.id,
        {
            recipientId,
            permission,
            scopeUnitId,
            canDelegate 
        }
    );
    return res.status(201).json(
        new ApiResponse(
            201,
            "Permission granted successfully",
            permissionGrant 
        )
    );
});

export const revokePermission = asyncHandler(async(req , res)=>{
    const {permissionGrantId} = req.params;
    const permissionGrant = await revokePermissionService(
        req.user.id,
        permissionGrantId
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            "Permission revoked successfully",
            permissionGrant 
        )
    );
});