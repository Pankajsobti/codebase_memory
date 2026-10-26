import { answerQuestion } from '../services/qaService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const postQuestion = asyncHandler(async function postQuestion(req, res, next) {
  const { repoId } = req.params;
  const { question } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required in request body' });
  }

  const result = await answerQuestion(repoId, question);
  return res.status(200).json(result);
});

export default { postQuestion };