import { Router } from 'express';
import { postQuestion } from '../controllers/qaController.js';

const router = Router();

router.post('/:repoId/qa', postQuestion);

export default router;