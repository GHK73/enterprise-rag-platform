// backend/src/services/metrics/metricsBuffer.service.js

import config from "../../config/config.js";
import prisma from "../../config/prisma.js";

const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 1000;
const MAX_FLUSH_BATCH_SIZE = 100;

const buffers = {
    apiRequest: [],
    authSecurity: [],
    queryPerformance: [],
    rateLimit: [],
    backgroundJob: [],
    dependency: [],
    benchmarkRun: [],
};

let flushTimer = null;
let flushPromise = null;

function getPrismaClient() {
    return prisma;
}

function addToBuffer(bufferName, metric) {
    const buffer = buffers[bufferName];
    if (!buffer) return false;

    if (buffer.length >= MAX_BUFFER_SIZE) {
        buffer.shift();
    }

    buffer.push(metric);
    return true;
}

async function flushBuffer(bufferName, createFn) {
    const buffer = buffers[bufferName];
    if (!buffer || buffer.length === 0) return;

    const toFlush = buffer.splice(0, Math.min(buffer.length, MAX_FLUSH_BATCH_SIZE));
    if (toFlush.length === 0) return;

    try {
        const client = getPrismaClient();
        await createFn(client, toFlush);
    } catch (error) {
        console.error(`METRICS: Failed to flush ${bufferName} buffer:`, error.message);
        buffers[bufferName].unshift(...toFlush);
    }
}

async function flushAll() {
    // A shutdown flush must wait for any timer-triggered flush already in
    // progress. Returning early here could let the caller disconnect Prisma
    // while that flush is still writing metrics.
    if (flushPromise) return flushPromise;

    flushPromise = (async () => {
        await Promise.all([
            flushBuffer("apiRequest", async (client, metrics) => {
                await client.apiRequestMetric.createMany({ data: metrics, skipDuplicates: true });
            }),
            flushBuffer("authSecurity", async (client, metrics) => {
                await client.authSecurityEvent.createMany({ data: metrics, skipDuplicates: true });
            }),
            flushBuffer("queryPerformance", async (client, metrics) => {
                await client.queryPerformanceMetric.createMany({ data: metrics, skipDuplicates: true });
            }),
            flushBuffer("rateLimit", async (client, metrics) => {
                await client.rateLimitMetric.createMany({ data: metrics, skipDuplicates: true });
            }),
            flushBuffer("backgroundJob", async (client, metrics) => {
                await client.backgroundJobMetric.createMany({ data: metrics, skipDuplicates: true });
            }),
            flushBuffer("dependency", async (client, metrics) => {
                await client.dependencyMetric.createMany({ data: metrics, skipDuplicates: true });
            }),
            flushBuffer("benchmarkRun", async (client, metrics) => {
                for (const metric of metrics) {
                    await client.benchmarkRun.upsert({
                        where: { runId: metric.runId },
                        update: metric,
                        create: metric,
                    });
                }
            }),
        ]);
    })();

    try {
        await flushPromise;
    } finally {
        flushPromise = null;
    }
}

function startFlushTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(flushAll, FLUSH_INTERVAL_MS);
    flushTimer.unref();
}

function stopFlushTimer() {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
}

async function shutdown() {
    stopFlushTimer();
    await flushAll();
}

export const metricsBuffer = {
    recordApiRequest: (metric) => addToBuffer("apiRequest", metric),
    recordAuthSecurity: (metric) => addToBuffer("authSecurity", metric),
    recordQueryPerformance: (metric) => addToBuffer("queryPerformance", metric),
    recordRateLimit: (metric) => addToBuffer("rateLimit", metric),
    recordBackgroundJob: (metric) => addToBuffer("backgroundJob", metric),
    recordDependency: (metric) => addToBuffer("dependency", metric),
    recordBenchmarkRun: (metric) => addToBuffer("benchmarkRun", metric),
    flushAll,
    shutdown,
    startFlushTimer,
    stopFlushTimer,
    getBufferSizes: () => Object.fromEntries(
        Object.entries(buffers).map(([k, v]) => [k, v.length])
    ),
};

if (config.app.env !== "test") {
    startFlushTimer();
}

export default metricsBuffer;
