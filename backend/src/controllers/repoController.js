import mongoose from 'mongoose';
import Repository from '../models/Repository.js';
import { runIngestPipeline } from '../services/ingestService.js';
import FileRecord from '../models/FileRecord.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
/**
 * Best-effort parse of {owner, name} out of a GitHub repo URL.
 * Falls back to undefined values if the URL shape is unexpected —
 * this is metadata only and shouldn't block repo creation.
 */
function parseOwnerAndName(repoUrl) {
  try {
    const cleaned = repoUrl.trim().replace(/\.git$/, '').replace(/\/+$/, '');
    const parts = cleaned.split('/').filter(Boolean);
    const name = parts.pop();
    const owner = parts.pop();
    return { owner, name };
  } catch {
    return { owner: undefined, name: undefined };
  }
}

/**
 * POST /api/v1/repos
 * Body: { repoUrl }
 *
 * Creates a Repository doc with status "pending", responds immediately
 * with { repoId }, then kicks off ingestRepo asynchronously (fire-and-forget).
 */
export const createRepo = asyncHandler(async function createRepo(req, res, next) {
  const { repoUrl } = req.body || {};

  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: 'repoUrl is required and must be a string' });
  }

  
  const { owner, name } = parseOwnerAndName(repoUrl);
  if (!owner || !name) {
  return res.status(400).json({ error: 'repoUrl must be a valid GitHub repo URL' });
}

  const repository = await Repository.create({
    repoUrl,
    owner,
    name,
    defaultBranch: 'main',
    status: 'pending',
  });

  // Respond right away — ingestion happens in the background.
  res.status(201).json({ repoId: repository._id });

  // Fire-and-forget: don't await, don't block the response above.
  // Errors are recorded on the Repository doc's status field by
  // ingestRepo itself; we just log here so the process doesn't crash
  // on an unhandled rejection.
  runIngestPipeline(repoUrl, repository._id).catch((err) => {
    console.error(`repoController: ingestion failed for repo ${repository._id}:`, err);
  });
});

/**
 * GET /api/v1/repos
 *
 * Returns all Repository documents, most recently created first.
 * Used by the dashboard to list previously analyzed repos.
 */
export const listRepos = asyncHandler(async function listRepos(req, res, next) {
  const repositories = await Repository.find().sort({ createdAt: -1 });
  res.json(repositories);
});

/**
 * GET /api/v1/repos/:repoId
 * Returns the Repository document (including its current status).
 */
export const getRepo = asyncHandler(async function getRepo(req, res, next) {
  const { repoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    return res.status(400).json({ error: 'Invalid repoId' });
  }

  const repository = await Repository.findById(repoId);

  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  res.json(repository);
});

export const getFileRecord = asyncHandler(async function getFileRecord(req, res, next) {
  const { repoId } = req.params;
  const filePath = decodeURIComponent(req.params.filePath);

  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    return res.status(400).json({ error: 'Invalid repoId' });
  }

  const fileRecord = await FileRecord.findOne({ repoId, filePath });

  if (!fileRecord) {
    return res.status(404).json({ error: `File record not found for path: ${filePath}` });
  }

  res.json(fileRecord);
});

/**
 * DELETE /api/v1/repos/:repoId
 *
 * Deletes the Repository doc and cascades the delete to all
 * associated FileRecord, GraphNode, and GraphEdge docs so we
 * don't leave orphaned data behind in Mongo.
 */
export const deleteRepo = asyncHandler(async function deleteRepo(req, res, next) {
  const { repoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    return res.status(400).json({ error: 'Invalid repoId' });
  }

  const repository = await Repository.findById(repoId);

  if (!repository) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  await Promise.all([
    FileRecord.deleteMany({ repoId }),
    GraphNode.deleteMany({ repoId }),
    GraphEdge.deleteMany({ repoId }),
  ]);

  await repository.deleteOne();

  res.status(200).json({ message: 'Repository deleted', repoId });
});

export default { createRepo, listRepos, getRepo, getFileRecord, deleteRepo };