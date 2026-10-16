import "../tests/setup.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { requestMetricsMiddleware } from "../src/middleware/metrics.middleware.js";
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
