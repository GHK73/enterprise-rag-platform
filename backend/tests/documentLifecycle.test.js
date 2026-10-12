import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    validDocumentTransitions,
    validateDocumentTransition,
} from "../src/services/document/documentHelpers.js";

import ApiError from "../src/utils/ApiError.js";

/*
 * The lifecycle state machine is authoritative:
 * every allowed transition must pass and every
 * rejected transition must throw a 400. The
 * table in documentHelpers.js is the single
 * copy — documentLifecycle.service.js imports
 * it.
 */
test("every transition in the authoritative table is accepted", () => {
    for (const [from, targets] of Object.entries(
        validDocumentTransitions
    )) {
        for (const to of targets) {
            assert.equal(
                validateDocumentTransition(from, to),
                true,
                `${from} -> ${to} should be allowed`
            );
        }
    }
});

test("transitions absent from the table are rejected with 400", () => {
    const rejected = [
        ["DRAFT", "READY"],
        ["DRAFT", "QUEUED"],
        ["SUBMITTED", "READY"],
        ["QUEUED", "READY"],
        ["QUEUED", "SUBMITTED"],
        ["PROCESSING", "QUEUED"],
        ["PROCESSING", "SUBMITTED"],
        ["READY", "PROCESSING"],
        ["READY", "SUBMITTED"],
        ["FAILED", "READY"],
        ["DELETED", "QUEUED"],
        ["DELETED", "PROCESSING"],
        ["EXPIRED", "DRAFT"],
        ["EXPIRED", "READY"],
        ["EXPIRED", "DELETED"],
        ["UNKNOWN", "READY"],
    ];

    for (const [from, to] of rejected) {
        assert.throws(
            () => validateDocumentTransition(from, to),
            (error) =>
                error instanceof ApiError &&
                error.statusCode === 400,
            `${from} -> ${to} should be rejected`
        );
    }
});

test("FAILED -> PROCESSING is allowed for worker retry recovery", () => {
    /*
     * BullMQ retries re-enter PROCESSING from
     * FAILED. This is deliberate: retry and
     * manual reprocess compose.
     */
    assert.equal(
        validDocumentTransitions.FAILED.includes("PROCESSING"),
        true
    );
});

test("the lifecycle module reuses the authoritative validator", async () => {
    /*
     * documentLifecycle.service.js must not
     * define its own transition table or its
     * own validateDocumentTransition: the only
     * export of the validator is the one from
     * documentHelpers.
     */
    const helpers = await import(
        "../src/services/document/documentHelpers.js"
    );
    const lifecycle = await import(
        "../src/services/document/documentLifecycle.service.js"
    );

    assert.equal(
        typeof lifecycle.validateDocumentTransition,
        "undefined",
        "documentLifecycle must not export its own transition validator"
    );
    assert.equal(
        typeof lifecycle.validDocumentTransitions,
        "undefined",
        "documentLifecycle must not export its own transition table"
    );
    assert.equal(
        typeof helpers.validateDocumentTransition,
        "function"
    );
    assert.equal(
        typeof helpers.validDocumentTransitions,
        "object"
    );
});
