import { PrismaClient } from "@prisma/client";

const isDevelopment = process.env.NODE_ENV !== "production";

const prisma = new PrismaClient({
    log: isDevelopment ? ["query", "info", "warn", "error"] : ["warn", "error"],
});

// Keep isActive and revokedAt in sync for DocumentAccessPolicy
prisma.$use(async (params, next) => {
    if (params.model === "DocumentAccessPolicy") {
        if (params.action === "update") {
            const data = params.args.data;
            if (data.isActive === false && !data.revokedAt) {
                data.revokedAt = new Date();
            } else if (data.isActive === true && data.revokedAt) {
                data.revokedAt = null;
            } else if (data.revokedAt && data.isActive !== false) {
                data.isActive = false;
            } else if (data.revokedAt === null && data.isActive !== true) {
                data.isActive = true;
            }
        }
        if (params.action === "create") {
            const data = params.args.data;
            if (data.revokedAt && data.isActive !== false) {
                data.isActive = false;
            } else if (!data.revokedAt && data.isActive !== true) {
                data.isActive = true;
            }
        }
    }
    return next(params);
});

// Keep isActive and revokedAt in sync for OrganizationDefaultAccessPolicy
prisma.$use(async (params, next) => {
    if (params.model === "OrganizationDefaultAccessPolicy") {
        if (params.action === "update") {
            const data = params.args.data;
            if (data.isActive === false && !data.revokedAt) {
                data.revokedAt = new Date();
            } else if (data.isActive === true && data.revokedAt) {
                data.revokedAt = null;
            } else if (data.revokedAt && data.isActive !== false) {
                data.isActive = false;
            } else if (data.revokedAt === null && data.isActive !== true) {
                data.isActive = true;
            }
        }
        if (params.action === "create") {
            const data = params.args.data;
            if (data.revokedAt && data.isActive !== false) {
                data.isActive = false;
            } else if (!data.revokedAt && data.isActive !== true) {
                data.isActive = true;
            }
        }
    }
    return next(params);
});

export default prisma;