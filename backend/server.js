// backend/server.js

import app from "./src/app.js";
import config from "./src/config/config.js";
import prisma from "./src/config/prisma.js";
import { initializeDocumentQueue } from "./src/services/document/documentQueue.service.js";
import "./src/workers/document.worker.js";

const startServer = async () => {
    try {
        await prisma.$connect();
        console.log("Connected to Neon Database");

        app.listen(config.app.port, async () => {
            console.log(
                `Server running on http://localhost:${config.app.port}`
            );

            if (config.redis.enabled) {
                await initializeDocumentQueue();
                console.log("Document processing queue initialized.");
            }
        });
    } catch (error) {
        console.error("Failed to connect to database");
        console.error(error);
        process.exit(1);
    }
};

startServer();