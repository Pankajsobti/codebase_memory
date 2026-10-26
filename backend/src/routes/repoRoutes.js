import { Router } from 'express';
import { createRepo, listRepos, getRepo, getFileRecord, deleteRepo } from '../controllers/repoController.js';

const router = Router();

// GET /api/v1/repos
router.get('/repos', listRepos);

// POST /api/v1/repos
router.post('/repos', createRepo);

// GET /api/v1/repos/:repoId
router.get('/repos/:repoId', getRepo);

// DELETE /api/v1/repos/:repoId
router.delete('/repos/:repoId', deleteRepo);

// GET /api/v1/repos/:repoId/files/:filePath*
router.get('/repos/:repoId/files/:filePath(*)', getFileRecord);

export default router;