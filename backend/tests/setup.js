/*
 * Test setup — must be the first import of every
 * test file. ESM evaluates imports in declaration
 * order, so this runs before any service module
 * (and therefore before config.js) is evaluated.
 *
 * The real backend .env enables Redis; tests must
 * not open connections to Redis, Prisma, S3, or
 * the AI service. dotenv does not overwrite
 * variables that are already set, so this value
 * wins over .env.
 */
process.env.REDIS_ENABLED = "false";
process.env.NODE_ENV = "test";
