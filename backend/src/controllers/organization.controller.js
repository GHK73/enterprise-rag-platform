// backend/src/controllers/organization.controller.js

import {
    createOrganization as createOrganizationService,
    getOrganization as getOrganizationService,
    updateOrganization as updateOrganizationService,
    createOrganizationUnit as createOrganizationUnitService,
    getOrganizationUnits as getOrganizationUnitsService,
    updateOrganizationUnit as updateOrganizationUnitService,
    deleteOrganizationUnit as deleteOrganizationUnitService,
    getOrganizationMembers as getOrganizationMembersService,
    getUnitCapacity,
    updateUnitCapacity,
    updateMemberRole as updateMemberRoleService,
    moveMember as moveMemberService,
    removeMember as removeMemberService,
    moveOrganizationUnit as moveOrganizationUnitService
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

export const getUnitCapacityController = asyncHandler(
    async(req,res)=>{
        const userId = req.user.id;
        const {unitId} = req.params;

        const capacity = await getUnitCapacity(userId,unitId);

        return res.status(200).json(
            new ApiResponse(
                200,
                "Organization unit capacity fetched successfully",
                capacity
            )
        );
    }
);

export const updateUnitCapacityController = asyncHandler(
    async(req,res)=>{
        const userId = req.user.id;
        const {unitId} = req.params;
        const organizationUnit = await updateUnitCapacity(
            userId, unitId, req.body
        );
        return res.status(200).json(
            new ApiResponse(200,"Organization unit capacity updated successfully",organizationUnit)
        );
    }
);

export const updateMemberRole = asyncHandler(async(req,res)=>{
    const {memberId} = req.params;
    const {role} = req.body;
    const member = await updateMemberRoleService(
        req.user.id,
        memberId,{
            role 
        }
    );
    return res.status(200).json(new ApiResponse(200,"Member role updated successfully",member));
});

export const moveMember = asyncHandler(async(req,res)=>{
    const {memberId} = req.params;
    const {unitId} = req.body;

    const member = await moveMemberService(
        req.user.id,
        memberId,{
            unitId
        }
    );
    return res.status(200).json(new ApiResponse(200,"Member moved Successfully", member));
});

export const removeMember = asyncHandler(async(req,res)=>{
    const {memberId} = req.params;

    const member = await removeMemberService(
        req.user.id,
        memberId
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Member removed successfully",
            member
        )
    );
});

export const moveOrganizationUnit = asyncHandler(async(req,res)=>{
    const {unitId} = req.params;
    const {parentId} = req.body;

    const organizationUnit = await moveOrganizationUnitService(
        req.user.id,
        unitId,
        {
            parentId
        }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Organization unit moved successfully",
            organizationUnit
        )
    );
});