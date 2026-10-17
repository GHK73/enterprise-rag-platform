import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { requestMetricsMiddleware } from "../src/middleware/metrics.middleware.js";
import { createApiRequestMetric } from "../src/services/metrics/metrics.service.js";
import { metricsBuffer } from "../src/services/metrics/metricsBuffer.service.js";

function makeResponse() {
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (name, value) => {
        res.headers[name.toLowerCase()] = value;
    };
    res.send = (body) => {
        res.body = body;
        return res;
    };
    return res;
}

test("request metrics are recorded when a response finishes through end", () => {
    const before = metricsBuffer.getBufferSizes().apiRequest;
    const req = { method: "GET", originalUrl: "/health" };
    const res = makeResponse();
    let nextCalled = false;

    requestMetricsMiddleware(req, res, () => {
        nextCalled = true;
    });

    res.statusCode = 204;
    res.emit("finish");

    assert.equal(nextCalled, true);
    assert.match(req.requestId, /^[a-f0-9]{32}$/);
    assert.equal(res.headers["x-request-id"], req.requestId);
    assert.equal(metricsBuffer.getBufferSizes().apiRequest, before + 1);
});

test("request metrics record once after send and use the completed status", () => {
    const before = metricsBuffer.getBufferSizes().apiRequest;
    const req = { method: "POST", originalUrl: "/api/v1/items" };
    const res = makeResponse();

    requestMetricsMiddleware(req, res, () => {});
    res.statusCode = 201;
    res.send({ ok: true });
    res.statusCode = 202;
    res.emit("finish");

    assert.deepEqual(res.body, { ok: true });
    assert.equal(metricsBuffer.getBufferSizes().apiRequest, before + 1);
});

test("API request metrics identify login and document APIs without recording content", () => {
    const loginMetric = createApiRequestMetric({
        requestId: "login-request",
        method: "POST",
        path: "/api/v1/auth/login?source=web",
        statusCode: 200,
        durationMs: 47,
    });
    const documentMetric = createApiRequestMetric({
        requestId: "document-request",
        method: "GET",
        path: "/api/v1/documents/cmh6ya1a20000x0v1g3fa1234?status=READY",
        statusCode: 200,
        durationMs: 83,
    });

    assert.equal(loginMetric.route, "/api/v1/auth/login");
    assert.equal(loginMetric.method, "POST");
    assert.equal(loginMetric.durationMs, 47);
    assert.equal(loginMetric.rawCacheOutcome, null);
    assert.equal(loginMetric.authorizedCacheOutcome, null);
    assert.equal(documentMetric.route, "/api/v1/documents/:documentId");
    assert.equal(documentMetric.method, "GET");
    assert.equal(documentMetric.durationMs, 83);
    assert.equal("content" in loginMetric, false);
    assert.equal("content" in documentMetric, false);
});

test("API request metrics include query cache outcomes with total duration", () => {
    const metric = createApiRequestMetric({
        requestId: "query-request",
        method: "POST",
        path: "/api/v1/query",
        statusCode: 200,
        durationMs: 4221,
        rawCacheOutcome: "BYPASS",
        authorizedCacheOutcome: "BYPASS",
    });

    assert.equal(metric.durationMs, 4221);
    assert.equal(metric.rawCacheOutcome, "BYPASS");
    assert.equal(metric.authorizedCacheOutcome, "BYPASS");
});
