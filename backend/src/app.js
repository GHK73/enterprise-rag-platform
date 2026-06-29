// backend/src/app.js

import express from 'express';
import cors from 'cors';

import routes from "./routes/index.js";
import notFound from "./middleware/notFound.middleware.js";
import errorHandler from "./middleware/error.middleware.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1",routes);

// 404 Middleware
app.use(notFound);

// Global error Handler
app.use(errorHandler);

export default app;