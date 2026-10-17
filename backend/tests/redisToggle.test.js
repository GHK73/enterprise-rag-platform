import "./setup.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import config from "../src/config/config.js";
import { redisClient } from "../src/config/redis.js";
import {
    checkLoginRateLimit,
    checkRegistrationRateLimit,
} from "../src/services/authRateLimit.service.js";
import {
    getCachedQuery,
    invalidateOrganizationQueryCache,
    setCachedQuery,
} from "../src/services/query/queryCache.service.js";
import {
    getCachedAuthorizedQuery,
    invalidateOrganizationAuthorizedQueryCache,
    setCachedAuthorizedQuery,
} from "../src/services/query/queryAccessCache.service.js";
import { metricsBuffer } from "../src/services/metrics/metricsBuffer.service.js";

test("disabling Redis avoids a client connection and bypasses Redis rate limits", async () => {
    assert.equal(config.redis.enabled, false);
    assert.equal(redisClient, null);

    const loginResult = await checkLoginRateLimit({
        email: "user@example.com",
        ip: "127.0.0.1",
    });
    const registrationResult = await checkRegistrationRateLimit({
        ip: "127.0.0.1",
    });
    const dependencyMetricsBefore = metricsBuffer.getBufferSizes().dependency;
    const queryCacheResult = await getCachedQuery(
        "org-1",
        "test query",
        5
    );
    await setCachedQuery("org-1", "test query", 5, []);
    await invalidateOrganizationQueryCache("org-1");
    const authorizedCacheResult = await getCachedAuthorizedQuery(
        "org-1",
        "scope-hash",
        "test query",
        5
    );
    await setCachedAuthorizedQuery("org-1", "scope-hash", "test query", 5, []);
    await invalidateOrganizationAuthorizedQueryCache("org-1");

    assert.deepEqual(loginResult, {
        blocked: false,
        bypassed: true,
        redisAvailable: false,
    });
    assert.deepEqual(registrationResult, {
        blocked: false,
        bypassed: true,
        redisAvailable: false,
    });
    assert.deepEqual(queryCacheResult, {
        data: null,
        outcome: "BYPASS",
        lookupMs: 0,
    });
    assert.deepEqual(authorizedCacheResult, {
        data: null,
        outcome: "BYPASS",
        lookupMs: 0,
    });
    assert.equal(
        metricsBuffer.getBufferSizes().dependency,
        dependencyMetricsBefore
    );
});
