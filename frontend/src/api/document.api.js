// frontend/src/api/document.api.js

import api from "./axios";

// ==============================
// Document Drafts
// ==============================

export const createDocumentDraft = async (documentData) => {
    const response = await api.post(
        "/documents/drafts",
        documentData
    );

    return response.data.data;
};

export const updateDocumentDraft = async (
    documentId,
    documentData
) => {
    const response = await api.patch(
        `/documents/${documentId}`,
        documentData
    );

    return response.data.data;
};

export const getDocuments = async () => {
    const response = await api.get(
        "/documents"
    );

    return response.data.data;
};

export const getDocumentById = async (
    documentId
) => {
    const response = await api.get(
        `/documents/${documentId}`
    );

    return response.data.data;
};

export const expireDocumentDrafts = async () => {
    const response = await api.post(
        "/documents/cleanup/expired-drafts"
    );

    return response.data;
};

// ==============================
// Draft Upload
// ==============================

export const uploadDraft = async (
    documentId,
    file,
    onUploadProgress,
) => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await api.post(
        `/documents/drafts/${documentId}/upload`,
        formData,
        {
            onUploadProgress,
        },
    );

    return response.data.data;
};

export const deleteDraftUpload = async (
    documentId
) => {
    const response = await api.delete(
        `/documents/drafts/${documentId}/upload`
    );

    return response.data;
};

// ==============================
// Publication
// ==============================

export const publishDocumentDraft = async (
    documentId
) => {
    const response = await api.post(
        `/documents/drafts/${documentId}/publish`
    );

    return response.data.data;
};

// ==============================
// Document Versions
// ==============================

export const getDocumentVersions = async (
    documentId,
) => {
    const response = await api.get(
        `/documents/${documentId}/versions`
    );

    return response.data.data;
};

export const getDocumentVersionById = async (
    documentId,
    versionId,
) => {
    const response = await api.get(
        `/documents/${documentId}/versions/${versionId}`
    );

    return response.data.data;
};

export const uploadDocumentVersion = async (
    documentId,
    file,
    onUploadProgress,
) => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await api.post(
        `/documents/${documentId}/versions`,
        formData,
        {
            onUploadProgress,
        },
    );

    return response.data.data;
};

// ==============================
// Access Policies
// ==============================

export const getDocumentAccessPolicies = async (
    documentId
) => {
    const response = await api.get(
        `/documents/${documentId}/access`
    );

    return response.data.data;
};

export const grantDocumentAccess = async (
    documentId,
    accessData
) => {
    const response = await api.post(
        `/documents/${documentId}/access`,
        accessData
    );

    return response.data.data;
};

export const updateDocumentAccessPolicy = async (
    policyId,
    accessData
) => {
    const response = await api.patch(
        `/documents/access/${policyId}`,
        accessData
    );

    return response.data.data;
};

export const revokeDocumentAccess = async (
    policyId,
    reason
) => {
    const response = await api.delete(
        `/documents/access/${policyId}`,
        {
            data: {
                reason,
            },
        }
    );

    return response.data;
};

export const grantTemporaryDocumentAccess = async (
    documentId,
    accessData
) => {
    const response = await api.post(
        `/documents/${documentId}/access/temporary`,
        accessData
    );

    return response.data.data;
};

// ==============================
// Access History
// ==============================

export const getDocumentAccessHistory = async (
    documentId
) => {
    const response = await api.get(
        `/documents/${documentId}/access/history`
    );

    return response.data.data;
};

// ==============================
// Downloads
// ==============================

export const getDocumentDownloadUrl = async (
    documentId
) => {
    const response = await api.get(
        `/documents/${documentId}/download-url`
    );

    return response.data.data;
};

export const downloadDocument = async (
    documentId,
    versionId,
) => {
    const endpoint = versionId
        ? `/documents/${documentId}/versions/${versionId}/download`
        : `/documents/${documentId}/download`;

    const response = await api.get(
        endpoint
    );

    return response.data.data;
};

// ==============================
// Deletion & Recovery
// ==============================

export const deleteDocument = async (
    documentId
) => {
    const response = await api.delete(
        `/documents/${documentId}`
    );

    return response.data;
};

export const restoreDocument = async (
    documentId
) => {
    const response = await api.patch(
        `/documents/${documentId}/restore`
    );

    return response.data.data;
};

export const cleanupDeletedDocument = async (
    documentId
) => {
    const response = await api.delete(
        `/documents/${documentId}/cleanup`
    );

    return response.data;
};