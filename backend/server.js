// backend/server.js

import app from "./src/app.js";
import config from "./src/config/config.js";
import prisma from "./src/config/prisma.js";
import { initializeDocumentQueue } from "./src/services/document/documentQueue.service.js";
import {
    recoverStaleProcessingDocuments,
    recoverStrandedPublications,
} from "./src/services/document/documentLifecycle.service.js";
import { metricsBuffer } from "./src/services/metrics/metricsBuffer.service.js";
import { startScheduledJobs, stopScheduledJobs } from "./src/services/scheduledJobs.service.js";
import "./src/workers/document.worker.js";

// Validate required environment variables at startup
const requiredEnvVars = ["JWT_SECRET", "DATABASE_URL"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
    console.error("Missing required environment variables:", missingEnvVars.join(", "));
    process.exit(1);
}

const startServer = async () => {
    try {
        await prisma.$connect();
        console.log("Connected to Neon Database");

        const server = app.listen(config.app.port, async () => {
            console.log(
                `Server running on http://localhost:${config.app.port}`
            );

            if (config.redis.enabled) {
                await initializeDocumentQueue();
                console.log("Document processing queue initialized.");
            }

            /*
             * Re-dispatch publications that were committed
             * but never dispatched because the process died
             * between the commit and the dispatch call.
             */
            const recovery = await recoverStrandedPublications();
            if (recovery.strandedDocuments > 0) {
                console.log(
                    `Publication recovery: ${recovery.recoveredDocuments} of ${recovery.strandedDocuments} stranded publications re-dispatched.`
                );
            }

            const processingRecovery =
                await recoverStaleProcessingDocuments();
            if (processingRecovery.staleDocuments > 0) {
                console.log(
                    `Processing recovery: ${processingRecovery.recoveredDocuments} of ${processingRecovery.staleDocuments} stale documents re-dispatched.`
                );
            }

            // Start scheduled cleanup jobs
            startScheduledJobs();
        });

        const gracefulShutdown = async (signal) => {
            console.log(`Received ${signal}, starting graceful shutdown...`);
            
            // Stop scheduled jobs first
            stopScheduledJobs();
            
            server.close(async () => {
                console.log("HTTP server closed");
                try {
                    await metricsBuffer.shutdown();
                    console.log("Metrics buffer flushed");
                    await prisma.$disconnect();
                    console.log("Database disconnected");
                    process.exit(0);
                } catch (error) {
                    console.error("Error during graceful shutdown:", error);
                    process.exit(1);
                }
            });

            // Force exit after 10 seconds if graceful shutdown hangs
            setTimeout(() => {
                console.error("Graceful shutdown timed out, forcing exit");
                process.exit(1);
            }, 10000);
        };

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    } catch (error) {
        console.error("Failed to connect to database");
        console.error(error);
        process.exit(1);
    }
};

startServer();