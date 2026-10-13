// backend/src/services/scheduledJobs.service.js

import config from "../config/config.js";
import prisma from "../config/prisma.js";
import { cleanupQueryHistory } from "./query/queryHistory.service.js";
import { cleanupExpiredDrafts } from "./document/documentLifecycle.service.js";

let cleanupTimers = [];

export const startScheduledJobs = () => {
    if (config.app.env === "test") {
        return;
    }

    // QueryHistory cleanup
    const queryHistoryIntervalMs = config.queryHistory.cleanupIntervalHours * 60 * 60 * 1000;
    const queryHistoryTimer = setInterval(async () => {
        try {
            const organizations = await prisma.organization.findMany({
                select: { id: true },
            });

            for (const org of organizations) {
                const result = await cleanupQueryHistory(org.id);
                if (result.deletedCount > 0) {
                    console.log(
                        `QUERY HISTORY CLEANUP: Deleted ${result.deletedCount} records older than ${result.retentionDays} days for org ${org.id}`
                    );
                }
            }
        } catch (error) {
            console.error("QUERY HISTORY CLEANUP: Failed", error.message);
        }
    }, queryHistoryIntervalMs);

    queryHistoryTimer.unref();
    cleanupTimers.push(queryHistoryTimer);

    // Expired drafts cleanup
    const draftsIntervalMs = 60 * 60 * 1000; // Every hour
    const draftsTimer = setInterval(async () => {
        try {
            const organizations = await prisma.organization.findMany({
                select: { id: true },
            });

            for (const org of organizations) {
                // Create a minimal user context for the cleanup
                // This requires a user with access to the organization
                const adminUser = await prisma.user.findFirst({
                    where: {
                        unit: { organizationId: org.id },
                        role: { in: ["OWNER", "ADMIN"] },
                    },
                    include: { unit: true },
                });

                if (adminUser) {
                    const result = await cleanupExpiredDrafts(adminUser);
                    if (result.cleanedDrafts > 0) {
                        console.log(
                            `EXPIRED DRAFTS CLEANUP: Cleaned ${result.cleanedDrafts} expired drafts for org ${org.id}`
                        );
                    }
                }
            }
        } catch (error) {
            console.error("EXPIRED DRAFTS CLEANUP: Failed", error.message);
        }
    }, draftsIntervalMs);

    draftsTimer.unref();
    cleanupTimers.push(draftsTimer);

    // S3 orphan cleanup reminder (runs daily)
    // Note: Full S3 orphan cleanup requires S3 ListObjects which is slow.
    // Recommended: Configure S3 Lifecycle policies to expire incomplete multipart uploads
    // and delete old versions. This job just logs a reminder.
    const s3IntervalMs = 24 * 60 * 60 * 1000; // Daily
    const s3Timer = setInterval(() => {
        console.log(
            "S3 ORPHAN CLEANUP: Consider configuring S3 Lifecycle policies for automatic cleanup of incomplete multipart uploads and old object versions. See AWS S3 console > Bucket > Management > Lifecycle rules."
        );
    }, s3IntervalMs);

    s3Timer.unref();
    cleanupTimers.push(s3Timer);

    console.log("Scheduled cleanup jobs started");
};

export const stopScheduledJobs = () => {
    for (const timer of cleanupTimers) {
        clearInterval(timer);
    }
    cleanupTimers = [];
    console.log("Scheduled cleanup jobs stopped");
};