import "dotenv/config";

import { performance } from "perf_hooks";

import Redis from "ioredis";

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]

local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call(
    "HMGET",
    key,
    "tokens",
    "timestamp"
)

local tokens = tonumber(data[1])
local timestamp = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    timestamp = now
end

local elapsed = math.max(
    0,
    now - timestamp
)

local refill =
    (elapsed / 1000) * refillRate

tokens = math.min(
    capacity,
    tokens + refill
)

local allowed = 0
local retryAfter = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local missing =
        requested - tokens

    retryAfter =
        math.ceil(
        missing / refillRate
    )
end

redis.call(
    "HMSET",
    key,
    "tokens",
    tokens,
    "timestamp",
    now
)

redis.call(
    "EXPIRE",
    key,
    math.ceil(
    (capacity / refillRate) * 2
    )
)

return {
    allowed,
    tokens,
    retryAfter
}
`;

const currentOptions = {
    maxRetriesPerRequest: 10,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 10000,
    commandTimeout: 10000,
    keepAlive: 10000,
    retryStrategy: (times) => Math.min(times * 500, 5000),
    reconnectOnError: (err) =>
        [
            "ECONNRESET",
            "ETIMEDOUT",
            "ECONNREFUSED",
            "EHOSTUNREACH",
        ].some((code) => err.message.includes(code)),
};

const failFastOptions = {
    ...currentOptions,
    maxRetriesPerRequest: 1,
    commandTimeout: 1000,
    enableOfflineQueue: false,
};

const realTarget = {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: {
        rejectUnauthorized: false,
        servername: process.env.REDIS_HOST,
    },
};

const refusedTarget = {
    host: "127.0.0.1",
    port: 6399,
};

const blackholeTarget = {
    host: process.env.BENCH_BLACKHOLE_HOST || "198.51.100.1",
    port: 6379,
};

const scenarios = [
    {
        label: "redis up            / current options",
        target: realTarget,
        options: currentOptions,
        iterations: 10,
        expectUp: true,
    },
    {
        label: "redis up            / fail-fast options",
        target: realTarget,
        options: failFastOptions,
        iterations: 10,
        expectUp: true,
    },
    {
        label: "redis refused       / current options",
        target: refusedTarget,
        options: currentOptions,
        iterations: 1,
    },
    {
        label: "redis refused       / fail-fast options",
        target: refusedTarget,
        options: failFastOptions,
        iterations: 1,
    },
    {
        label: "redis blackhole     / current options",
        target: blackholeTarget,
        options: currentOptions,
        iterations: 1,
    },
    {
        label: "redis blackhole     / fail-fast options",
        target: blackholeTarget,
        options: failFastOptions,
        iterations: 1,
    },
];

const withTimeout = (promise, ms, label) =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(
            () =>
                reject(
                    new Error(
                        `${label} exceeded ${ms}ms`
                    )
                ),
            ms
        );

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });

const percentile = (sorted, p) => {
    if (sorted.length === 0) return null;

    const index = Math.min(
        sorted.length - 1,
        Math.floor((p / 100) * sorted.length)
    );

    return sorted[index];
};

const fmt = (value) =>
    value === null
        ? "-"
        : `${value.toFixed(1)} ms`;

const runScenario = async (scenario) => {
    const client = new Redis({
        ...scenario.options,
        ...scenario.target,
    });

    let connectMs = null;

    if (scenario.expectUp) {
        const startedConnect =
            performance.now();

        try {
            await withTimeout(
                new Promise((resolve, reject) => {
                    client.once("ready", resolve);
                    client.once(
                        "error",
                        reject
                    );
                }),
                15000,
                "connect"
            );

            connectMs =
                performance.now() -
                startedConnect;
        } catch (error) {
            client.disconnect();

            return {
                label: scenario.label,
                connectMs,
                samples: [],
                error: error.message,
            };
        }
    }

    client.defineCommand("consumeToken", {
        numberOfKeys: 1,
        lua: TOKEN_BUCKET_SCRIPT,
    });

    const samples = [];

    let error = null;

    for (let i = 0; i < scenario.iterations; i++) {
        const started =
            performance.now();

        try {
            await withTimeout(
                client.consumeToken(
                    `bench:token-bucket:user:bench`,
                    Date.now(),
                    30,
                    0.5,
                    1
                ),
                180000,
                "consumeToken"
            );

            samples.push(
                performance.now() - started
            );
        } catch (caught) {
            error = caught.message;
            samples.push(
                performance.now() - started
            );
            break;
        }
    }

    client.disconnect();

    return {
        label: scenario.label,
        connectMs,
        samples,
        error,
    };
};

const main = async () => {
    console.log(
        "Timing the exact token-bucket call used by queryRateLimiter / documentUploadRateLimiter"
    );
    console.log(
        `target: ${realTarget.host}:${realTarget.port} (upstash over TLS)`
    );
    console.log(
        `refused: ${refusedTarget.host}:${refusedTarget.port}   blackhole: ${blackholeTarget.host}:${blackholeTarget.port}`
    );
    console.log("");

    const results = [];

    for (const scenario of scenarios) {
        process.stdout.write(
            `running  ${scenario.label} ... `
        );

        const result = await runScenario(
            scenario
        );

        results.push(result);

        console.log("done");
    }

    console.log("");
    console.log(
        "scenario                            | connect   | min      | median   | p95      | max"
    );
    console.log(
        "------------------------------------|-----------|----------|----------|----------|----------"
    );

    for (const result of results) {
        const sorted = [
            ...result.samples,
        ].sort((a, b) => a - b);

        console.log(
            [
                result.label.padEnd(36),
                fmt(result.connectMs).padEnd(9),
                fmt(percentile(sorted, 0)).padEnd(8),
                fmt(percentile(sorted, 50)).padEnd(8),
                fmt(percentile(sorted, 95)).padEnd(8),
                fmt(percentile(sorted, 100)).padEnd(8),
                result.error
                    ? `-> ${result.error}`
                    : "",
            ].join(" | ")
        );
    }

    const upCurrent = results[0];
    const upFailFast = results[1];
    const downCurrent = results[2];
    const downFailFast = results[3];

    const median = (r) =>
        percentile(
            [...r.samples].sort(
                (a, b) => a - b
            ),
            50
        );

    console.log("");

    if (upCurrent.samples.length > 0) {
        console.log(
            `happy path cost of Redis (upstash RTT): ${fmt(
                median(upCurrent)
            )} median`
        );
    }

    if (
        downCurrent.samples.length > 0 &&
        downFailFast.samples.length > 0
    ) {
        const ratio =
            median(downCurrent) /
            median(downFailFast);

        console.log(
            `outage stall, current options: ${fmt(
                median(downCurrent)
            )}   fail-fast options: ${fmt(
                median(downFailFast)
            )}   (${ratio.toFixed(
                1
            )}x faster)`
        );
    }
};

main().then(
    () => process.exit(0),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
