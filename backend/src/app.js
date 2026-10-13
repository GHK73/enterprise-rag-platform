// backend/src/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import config from "./config/config.js";
import routes from "./routes/index.js";
import notFound from "./middleware/notFound.middleware.js";
import errorHandler from "./middleware/error.middleware.js";
import { requestMetricsMiddleware } from "./middleware/metrics.middleware.js";

const app = express();

// Helmet security headers
app.use(helmet({
    contentSecurityPolicy: config.app.env === "production" ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    } : false, // Disable CSP in development for easier debugging
    hsts: config.app.env === "production" ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    frameguard: { action: "deny" },
}));

app.use(cors(config.app.cors));
app.use(express.json());
app.use(requestMetricsMiddleware);

app.use("/api/v1", routes);

// 404 Middleware
app.use(notFound);

// Global error Handler
app.use(errorHandler);

export default app;