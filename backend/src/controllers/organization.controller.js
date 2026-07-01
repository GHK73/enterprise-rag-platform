// backend/src/controllers/organization.controller.js

import {createOrganization as createOrganizationService} from "../services/organization.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const createOrganization = asyncHandler(async(req,res)=>{
    const {name,description} = req.body;
    const organization = await createOrganizationService(
        req.user.id,
        {
            name,
            description
        }
    );
    return res.status(201).json(
        new ApiResponse(
            201,
            organization,
            "Organization created successfully"
        )
    );
});