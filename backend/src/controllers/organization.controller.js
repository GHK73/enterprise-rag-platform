// backend/src/controllers/organization.controller.js

import {
    createOrganization as createOrganizationService,
    getOrganization as getOrganizationService,
    updateOrganization as updateOrganizationService,
    createOrganizationUnit as createOrganizationUnitService,
    getOrganizationUnits as getOrganizationUnitsService,
    updateOrganizationUnit as updateOrganizationUnitService,
    deleteOrganizationUnit as deleteOrganizationUnitService,
    getOrganizationMembers as getOrganizationMembersService
} from "../services/organization.service.js";
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
            "Organization created successfully",
            organization
        )
    );
});

export const getOrganization = asyncHandler(async(req,res)=>{
    const organization = await getOrganizationService(req.user.id);
    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization fetched successfully",
            organization 
        )
    );
});

export const updateOrganization = asyncHandler(async(req,res)=>{
    const {name,description} = req.body;
    const organization = await updateOrganizationService(
        req.user.id,
        {
            name,
            description 
        }
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization updated Successfully",
            organization 
        )
    );
});

export const createOrganizationUnit = asyncHandler(async(req,res) => {
    const {name, type, parentId} = req.body;
    const organizationUnit = await createOrganizationUnitService(
        req.user.id,
        {
            name,
            type,
            parentId 
        }
    );
    return res.status(201).json(
        new ApiResponse(
            201,
            "Organization unit created successfully",
            organizationUnit 
        )
    );
});

export const getOrganizationUnits = asyncHandler(async(req,res)=>{
    const organizationUnits = await getOrganizationUnitsService(
        req.user.id
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization units fetched successfully",
            organizationUnits 
        )
    );
});

export const updateOrganizationUnit = asyncHandler(async(req,res)=>{
    const {unitId} = req.params;
    const {name} = req.body;
    const organizatioinUnit = await updateOrganizationUnitService(
        req.user.id,
        unitId,
        {
            name 
        }
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization unit updated successfully",
            organizatioinUnit 
        )
    );
});

export const deleteOrganizationUnit = asyncHandler(async(req,res)=>{
    const {unitId} = req.params;
    const organizationUnit = await deleteOrganizationUnitService(
        req.user.id,
        unitId 
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization unit deleted successfully",
            organizationUnit 
        )
    );
});
export const getOrganizationMembers = asyncHandler(async(req,res)=>{
    const organizationMembers =
        await getOrganizationMembersService(
            req.user.id
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization members fetched successfully",
            organizationMembers
        )
    );
});