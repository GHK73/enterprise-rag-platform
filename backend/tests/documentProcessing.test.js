import "./setup.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import {
    buildProcessingClaimWhere,
    STALE_PROCESSING_DOCUMENT_MS,
} from "../src/services/document/documentHelpers.js";

test("processing claims allow ordinary source statuses and stale retries", () => {
    const staleBefore = new Date("2026-10-16T10:00:00.000Z");

    assert.deepEqual(
        buildProcessingClaimWhere(
            "document-id",
            "version-id",
            staleBefore
        ),
        {
            id: "document-id",
            currentVersionId: "version-id",
            OR: [
                {
                    status: {
                        in: ["SUBMITTED", "QUEUED", "FAILED"],
                    },
                },
                {
                    status: "PROCESSING",
                    updatedAt: {
                        lte: staleBefore,
                    },
                },
            ],
        }
    );
});

test("processing claims use the shared ten-minute stale threshold", () => {
    const before = Date.now();
    const where = buildProcessingClaimWhere(
        "document-id",
        "version-id"
    );
    const after = Date.now();
    const cutoff = where.OR[1].updatedAt.lte.getTime();

    assert.equal(STALE_PROCESSING_DOCUMENT_MS, 10 * 60 * 1000);
    assert.ok(cutoff >= before - STALE_PROCESSING_DOCUMENT_MS);
    assert.ok(cutoff <= after - STALE_PROCESSING_DOCUMENT_MS);
});
