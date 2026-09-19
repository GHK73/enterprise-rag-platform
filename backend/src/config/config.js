// backend/src/config/config.js

import dotenv from "dotenv";

dotenv.config();

export default {
    app: {
        port: process.env.PORT,
        env: process.env.NODE_ENV,
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
        url: process.env.REDIS_URL,
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
};