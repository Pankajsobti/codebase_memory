import express from 'express';
import { getGraph } from '../controllers/graphController.js';

// mergeParams so this router can read :repoId when mounted under
// e.g. app.use('/api/v1/repos/:repoId/graph', graphRoutes)
const router = express.Router({ mergeParams: true });

router.get('/', getGraph);

export default router;