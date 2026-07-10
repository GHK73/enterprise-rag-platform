// backend/src/controllers/document.controller.js

import{
    createDocumentDraft as createDocumentDraftService,
    updateDocumentDraft as updateDocumentDraftService,
    getDocuments as getDocumentsService,
    getDocumentById as getDocumentByIdService
} from "../services/document.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

export const createDocumentDraft = asyncHandler(async(req,res)=>{
    const {title,description,classification} = req.body;

    const document = await createDocumentDraftService(
        req.user,
        {
            title,
            description,
            classification
        }
    );

    return res.status(201).json(
        new ApiResponse(201,"Document draft created successfully",document)
    );
});

export const updateDocumentDraft = asyncHandler(async(req,res)=>{
    const {documentId} = req.params;

    const document = await updateDocumentDraftService(
        req.user,
        documentId,
        req.body
    );

    return res.status(200).json(
        new ApiResponse(200,"Document draft updated successfully",document)
    );
});

export const getDocuments = asyncHandler(async(req,res)=>{
    const documents = await getDocumentsService(req.user);

    return res.status(200).json(
        new ApiResponse(200,"Documents fetched successfully",documents)
    );
});

export const getDocumentById = asyncHandler(async(req,res)=>{
    const {documentId} = req.params;

    const document = await getDocumentByIdService(
        req.user,
        documentId
    );

    return res.status(200).json(
        new ApiResponse(200,"Document fetched successfully",document)
    );
});

