import { getRepoSummary } from '../services/summaryService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const getSummary = asyncHandler(async function getSummary(req, res, next) {
  const { repoId } = req.params;
  const result = await getRepoSummary(repoId);
  return res.status(200).json(result);
});

export default { getSummary };