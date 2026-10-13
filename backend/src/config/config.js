import dotenv from "dotenv";

dotenv.config();

export default {
    app: {
        port: process.env.PORT,
        env: process.env.NODE_ENV,
        cors: {
            origin: process.env.CORS_ORIGIN
                ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
                : "*",
            credentials: process.env.CORS_CREDENTIALS === "true",
        },
    },

    database: {
        url: process.env.DATABASE_URL,
    },

    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
    },

    aws: {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        bucket: process.env.AWS_S3_BUCKET,
    },

    redis: {
        enabled: process.env.REDIS_ENABLED === "true",
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === "true",
    },

    ai: {
        url: process.env.AI_SERVICE_URL,
    },

    llm: {
        provider: process.env.LLM_PROVIDER || "bedrock",
        modelId:
            process.env.LLM_MODEL_ID ||
            "amazon.nova-pro-v1:0",
        region:
            process.env.AWS_REGION || "us-east-1",
        maxTokens: Number(
            process.env.LLM_MAX_TOKENS || 1000
        ),
        temperature: Number(
            process.env.LLM_TEMPERATURE || 0
        ),
    },

    rateLimit: {
        /*
         * Behavior when Redis is unavailable and a
         * rate-limit check cannot be executed:
         *
         * "open"   — allow the request through
         *            (availability-first; the default)
         * "closed" — reject with 503
         *            (protection-first; prevents
         *            unbounded LLM and processing load
         *            during a Redis outage)
         *
         * See docs/DEVELOPMENT.md — Known Backend
         * Issues for the policy rationale.
         */
        unavailablePolicy:
            process.env.RATE_LIMIT_UNAVAILABLE_POLICY ===
                "closed"
                ? "closed"
                : "open",

        query: {
            capacity: Number(
                process.env.QUERY_RATE_LIMIT_CAPACITY || 30
            ),
            refillRate: Number(
                process.env.QUERY_RATE_LIMIT_REFILL_RATE || 0.5
            ),
            refillIntervalSeconds: Number(
                process.env.QUERY_RATE_LIMIT_REFILL_INTERVAL || 1
            ),
        },

        documentUpload: {
            capacity: Number(
                process.env.DOCUMENT_UPLOAD_RATE_LIMIT_CAPACITY || 10
            ),
            refillRate: Number(
                process.env.DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_RATE || 1
            ),
            refillIntervalSeconds: Number(
                process.env.DOCUMENT_UPLOAD_RATE_LIMIT_REFILL_INTERVAL || 60
            ),
        },

        login: {
            emailMaxAttempts: Number(
                process.env.LOGIN_RATE_LIMIT_EMAIL_MAX_ATTEMPTS || 5
            ),
            ipMaxAttempts: Number(
                process.env.LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS || 20
            ),
            windowSeconds: Number(
                process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS || 15 * 60
            ),
        },

        registration: {
            ipMaxAttempts: Number(
                process.env.REGISTRATION_RATE_LIMIT_IP_MAX_ATTEMPTS || 5
            ),
            windowSeconds: Number(
                process.env.REGISTRATION_RATE_LIMIT_WINDOW_SECONDS || 15 * 60
            ),
        },
    },

    queryHistory: {
        retentionDays: Number(process.env.QUERY_HISTORY_RETENTION_DAYS || 90),
        cleanupIntervalHours: Number(process.env.QUERY_HISTORY_CLEANUP_INTERVAL_HOURS || 24),
    },
};