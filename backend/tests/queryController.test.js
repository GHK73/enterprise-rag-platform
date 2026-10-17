import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";

import asyncHandler from "../src/utils/asyncHandler.js";
import {
    createQueryDocumentsHandler,
    queryDocuments,
} from "../src/controllers/query.controller.js";

/*
 * The controller's response mapping is the
 * HTTP contract the frontend consumes. The
 * orchestrator seam keeps the mapping
 * testable without live infrastructure;
 * the pipeline itself is covered by
 * queryPipeline.test.js against the real
 * retrieveAuthorizedCandidates.
 */
const orchestrationResult = () => ({
    query: "What is the revenue target?",
    answer: "The target is 4.2 million [Source 1].",
    sources: [
        {
            index: 1,
            chunkId: "chunk-1",
            documentId: "doc-1",
            versionId: "v1",
            pageNumber: 3,
            score: 0.86,
        },
    ],
    evidence: {
        sufficient: true,
        reason: "SUFFICIENT_EVIDENCE",
    },
    usedLLM: true,
    outputGuardPassed: true,
});

const makeRes = () => {
    const res = {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    return res;
};

const okOrchestrator = async () =>
    orchestrationResult();

const makeQueryDocumentsHandler = (
    orchestrator = okOrchestrator
) => createQueryDocumentsHandler(orchestrator);

test("POST /query returns exactly the documented response fields", async () => {
    const res = makeRes();
    await makeQueryDocumentsHandler()(
        { body: { query: "What is the revenue target?", topK: 5 }, user: { id: "user-1" } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, "Query executed successfully.");

    /*
     * Platform API contract (docs/DEVELOPMENT.md):
     * query, answer, sources, evidence, usedLLM,
     * outputGuardPassed — and nothing else.
     */
    assert.deepEqual(
        Object.keys(res.body.data).sort(),
        [
            "answer",
            "evidence",
            "outputGuardPassed",
            "query",
            "sources",
            "usedLLM",
        ].sort()
    );

    assert.equal(res.body.data.query, "What is the revenue target?");
    assert.equal(res.body.data.answer, "The target is 4.2 million [Source 1].");
    assert.equal(res.body.data.sources[0].documentId, "doc-1");
    assert.equal(res.body.data.evidence.sufficient, true);
    assert.equal(res.body.data.usedLLM, true);
    assert.equal(res.body.data.outputGuardPassed, true);
});

test("POST /query stores cache outcomes on request metrics", async () => {
    const req = {
        body: { query: "What is the revenue target?", topK: 5 },
        user: { id: "user-1" },
        metrics: {},
    };
    const handler = makeQueryDocumentsHandler(async (_user, _query, _topK, dependencies) => {
        dependencies.onCacheOutcome("raw", "MISS");
        dependencies.onCacheOutcome("authorized", "HIT");
        return orchestrationResult();
    });

    await handler(req, makeRes());

    assert.equal(req.metrics.rawCacheOutcome, "MISS");
    assert.equal(req.metrics.authorizedCacheOutcome, "HIT");
});

test("POST /query maps the insufficient-evidence fallback identically", async () => {
    const res = makeRes();
    const fallbackOrchestrator = async () => ({
        query: "What is the revenue target?",
        answer:
            "I couldn't find sufficient information in the authorized documents to answer this question.",
        sources: [],
        evidence: {
            sufficient: false,
            reason: "NO_AUTHORIZED_EVIDENCE",
        },
        usedLLM: false,
        outputGuardPassed: false,
    });

    await makeQueryDocumentsHandler(fallbackOrchestrator)(
        { body: { query: "What is the revenue target?" }, user: { id: "user-1" } },
        res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.usedLLM, false);
    assert.equal(res.body.data.outputGuardPassed, false);
    assert.deepEqual(res.body.data.sources, []);
    assert.equal(res.body.data.evidence.reason, "NO_AUTHORIZED_EVIDENCE");
});

test("POST /query rejects a missing query with 400", async () => {
    const res = makeRes();
    await makeQueryDocumentsHandler()(
        { body: {}, user: { id: "user-1" } },
        res
    );

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Query is required.");
});

test("POST /query rejects a whitespace-only query with 400", async () => {
    const res = makeRes();
    await makeQueryDocumentsHandler()(
        { body: { query: "   " }, user: { id: "user-1" } },
        res
    );

    assert.equal(res.statusCode, 400);
});

test("POST /query rejects topK outside 1-20 with 400", async () => {
    for (const topK of [0, 21, -1]) {
        const res = makeRes();
        await makeQueryDocumentsHandler()(
            { body: { query: "q", topK }, user: { id: "user-1" } },
            res
        );
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.message, "topK must be an integer between 1 and 20.");
    }
});

test("POST /query rejects a non-integer topK with 400", async () => {
    const res = makeRes();
    await makeQueryDocumentsHandler()(
        { body: { query: "q", topK: "five" }, user: { id: "user-1" } },
        res
    );

    assert.equal(res.statusCode, 400);
});

test("Express next is not passed to the query orchestrator", async () => {
    const res = makeRes();
    let capturedError;

    const next = (error) => {
        capturedError = error;
    };

    await queryDocuments(
        {
            body: { query: "What is the revenue target?" },
            user: {},
        },
        res,
        next
    );

    assert.equal(capturedError?.statusCode, 403);
    assert.equal(capturedError?.message, "User organization could not be determined.");
});

test("asyncHandler forwards handler errors to next", async () => {
    let captured = null;
    const next = (error) => {
        captured = error;
    };

    const handler = asyncHandler(
        async () => {
            throw new Error("orchestration failed");
        }
    );

    /*
     * asyncHandler returns the promise chain,
     * so awaiting it waits for the catch
     * branch to forward the error to next.
     */
    await handler(
        {},
        makeRes(),
        next
    );

    assert.equal(captured.message, "orchestration failed");
});

test("the express-wrapped queryDocuments is a function of (req, res, next)", () => {
    assert.equal(typeof queryDocuments, "function");
    assert.equal(queryDocuments.length, 3);
});
