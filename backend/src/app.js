import express from "express";
import cors from "cors";
import morgan from "morgan";
import env from "./config/env.js";
import repoRoutes from './routes/repoRoutes.js';
import graphRoutes from './routes/graphRoutes.js';
import qaRoutes from './routes/qaRoutes.js';
import errorHandler from './middleware/errorHandler.js';
// ... alongside your other route imports
import summaryRoutes from './routes/summaryRoutes.js';
// ... alongside your other route imports

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(morgan("dev"));
app.use('/api/v1/repos/:repoId/summary', summaryRoutes);
app.use('/api/v1/repos/:repoId/graph', graphRoutes);
app.use('/api/v1/repos', qaRoutes);
app.use('/api/v1', repoRoutes);
// ... alongside your other app.use(...) route mounts
// Placeholder router mounted at /api/v1.
// Prompt 2+ will replace/extend this with repoRoutes, graphRoutes, qaRoutes.




// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler — must be last.
app.use(errorHandler);

export default app;