// backend/src/controllers/document.controller.js

import {
    createDocumentDraft as createDocumentDraftService,
    updateDocumentDraft as updateDocumentDraftService,
    getDocuments as getDocumentsService,
    getDocumentById as getDocumentByIdService,

    uploadDraft as uploadDraftService,
    deleteDraftUpload as deleteDraftUploadService,
    publishDraft as publishDraftService,

    getDocumentVersions as getDocumentVersionsService,
    getDocumentVersionById as getDocumentVersionByIdService,
    uploadDocumentVersion as uploadDocumentVersionService,
    getDocumentDownloadUrl as getDocumentDownloadUrlService,

    grantDocumentAccess as grantDocumentAccessService,
    updateDocumentAccessPolicy as updateDocumentAccessPolicyService,
    revokeDocumentAccess as revokeDocumentAccessService,
    getDocumentAccessPolicies as getDocumentAccessPoliciesService,
    getDocumentAccessPolicyById as getDocumentAccessPolicyByIdService,
    getDocumentAccessHistory as getDocumentAccessHistoryService,
    grantTemporaryDocumentAccess as grantTemporaryDocumentAccessService,

    softDeleteDocument as softDeleteDocumentService,
    restoreDocument as restoreDocumentService,
    cleanupDeletedDocument as cleanupDeletedDocumentService,
    cleanupExpiredDrafts as cleanupExpiredDraftsService,
} from "../services/document.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import serializeBigInt from "../utils/serializeBigInt.js";

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

export const uploadDraft = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    const version = await uploadDraftService(
        req.user,
        documentId,
        req.file
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Draft uploaded successfully",
            serializeBigInt(version)
        )
    );
});

export const deleteDraftUpload = asyncHandler(async(req,res)=>{
    const {documentId} = req.params;
    await deleteDraftUploadService(req.user, documentId);

    return res.status(200).json(new ApiResponse(200,"Draft upload deleted successfully"));
});

export const publishDraft = asyncHandler(async(req,res)=>{
    const {documentId} = req.params;
    const document = await publishDraftService(req.user, documentId);

    return res.status(200).json(new ApiResponse(200,"Document published successfully",document));
});

export const getDocumentVersions = asyncHandler(async(req,res)=>{
    const versions =
        await getDocumentVersionsService(
            req.user,
            req.params.documentId
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Document versions fetched successfully",
            versions
        )
    );
});

export const getDocumentVersionById = asyncHandler(async(req,res)=>{
    const version =
        await getDocumentVersionByIdService(
            req.user,
            req.params.documentId,
            req.params.versionId
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Document version fetched successfully",
            version
        )
    );
});

export const uploadDocumentVersion = asyncHandler(async(req,res)=>{
    const version =
        await uploadDocumentVersionService(
            req.user,
            req.params.documentId,
            req.file
        );

    return res.status(201).json(
        new ApiResponse(
            201,
            "Document version uploaded successfully",
            version
        )
    );
});

export const getDocumentDownloadUrl = asyncHandler(async(req,res)=>{
    const result =
        await getDocumentDownloadUrlService(
            req.user,
            req.params.documentId,
            req.params.versionId
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Download URL generated successfully",
            result
        )
    );
});

export const grantDocumentAccess = asyncHandler(async(req,res)=>{
    const policy =
        await grantDocumentAccessService(
            req.user,
            req.params.documentId,
            req.body
        );

    return res.status(201).json(
        new ApiResponse(
            201,
            "Document access granted successfully",
            policy
        )
    );
});

export const updateDocumentAccessPolicy = asyncHandler(async(req,res)=>{
    const policy = await updateDocumentAccessPolicyService(
        req.user,
        req.params.policyId,
        req.body 
    );
    return res.status(200).json(new ApiResponse(200,"Document access updated successfully",policy));
});

export const revokeDocumentAccess = asyncHandler(
    async (req, res) => {

        const policy =
            await revokeDocumentAccessService(
                req.user,
                req.params.policyId,
                req.body.reason
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Document access revoked successfully",
                policy
            )
        );
    }
);

export const getDocumentAccessPolicies = asyncHandler(
    async (req, res) => {

        const policies =
            await getDocumentAccessPoliciesService(
                req.user,
                req.params.documentId
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Document access policies fetched successfully",
                policies
            )
        );
    }
);

export const getDocumentAccessPolicyById = asyncHandler(async(req,res)=>{
    const policy =
        await getDocumentAccessPolicyByIdService(
            req.user,
            req.params.policyId
        );

    return res.status(200).json(
        new ApiResponse(
            200,
            "Document access policy fetched successfully",
            policy
        )
    );
});

export const getDocumentAccessHistory = asyncHandler(
    async (req, res) => {

        const history =
            await getDocumentAccessHistoryService(
                req.user,
                req.params.documentId
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Document access history fetched successfully",
                history
            )
        );
    }
);

export const grantTemporaryDocumentAccess = asyncHandler(
    async (req, res) => {

        const policy =
            await grantTemporaryDocumentAccessService(
                req.user,
                req.params.documentId,
                req.body
            );

        return res.status(201).json(
            new ApiResponse(
                201,
                "Temporary document access granted successfully",
                policy
            )
        );
    }
);

export const softDeleteDocument = asyncHandler(
    async (req, res) => {

        const document =
            await softDeleteDocumentService(
                req.user,
                req.params.documentId
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Document deleted successfully",
                document
            )
        );
    }
);

export const restoreDocument = asyncHandler(
    async (req, res) => {

        const document =
            await restoreDocumentService(
                req.user,
                req.params.documentId
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Document restored successfully",
                document
            )
        );
    }
);

export const cleanupDeletedDocument = asyncHandler(
    async (req, res) => {

        const result =
            await cleanupDeletedDocumentService(
                req.user,
                req.params.documentId
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Document cleanup completed successfully",
                result
            )
        );
    }
);

export const cleanupExpiredDrafts = asyncHandler(
    async (req, res) => {

        const result =
            await cleanupExpiredDraftsService(
                req.user
            );

        return res.status(200).json(
            new ApiResponse(
                200,
                "Expired drafts cleaned successfully",
                result
            )
        );
    }
);