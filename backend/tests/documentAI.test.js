import "./setup.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import {
    handleProcessingSuccess,
} from "../src/services/document/documentAI.service.js";

const expected = {
    documentId: "document-id",
    versionId: "version-id",
};

test("accepts a matching successful AI processing response", async () => {
    const response = {
        success: true,
        message: "Document processed successfully.",
        document_id: expected.documentId,
        version_id: expected.versionId,
    };

    assert.equal(
        await handleProcessingSuccess(response, expected),
        response
    );
});

test("rejects an unsuccessful AI processing response", async () => {
    await assert.rejects(
        handleProcessingSuccess(
            {
                success: false,
                document_id: expected.documentId,
                version_id: expected.versionId,
            },
            expected
        ),
        /invalid processing response/
    );
});

test("rejects an AI response for a different document version", async () => {
    await assert.rejects(
        handleProcessingSuccess(
            {
                success: true,
                document_id: expected.documentId,
                version_id: "another-version",
            },
            expected
        ),
        /invalid processing response/
    );
});
