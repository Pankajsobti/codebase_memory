// backend/src/services/ingestService.js
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import simpleGit from 'simple-git';
import Repository from '../models/Repository.js';
import FileRecord from '../models/FileRecord.js';
import { parseFile } from './parserService.js';
import { buildGraph } from './graphBuilderService.js';
/**
 * Directory names to skip entirely while walking the cloned repo.
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.cache',
  'coverage',
  'vendor',
  '.venv',
  '__pycache__',
]);

/**
 * Supported source file extensions -> language label.
 * Only files with one of these extensions are parsed/ingested.
 */
const LANGUAGE_BY_EXT = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
};

/**
 * Explicit binary / non-source extensions to always skip, even if they
 * somehow slip past the "not in LANGUAGE_BY_EXT" filter (defense in depth,
 * and useful if LANGUAGE_BY_EXT is expanded later to include ambiguous exts).
 */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.mov', '.avi', '.mkv',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.class', '.jar',
  '.lock',
]);

function getWorkDir(repoId) {
  return path.join(os.tmpdir(), 'codebase-memory', String(repoId));
}

/**
 * Clones the given repo URL into workDir (shallow clone), first clearing
 * out any pre-existing directory for this repoId.
 */
async function cloneRepo(repoUrl, workDir) {
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });

  const git = simpleGit();
  await git.clone(repoUrl, workDir, ['--depth', '1']);
}

/**
 * Recursively walks dir (relative to baseDir), pushing a record for every
 * supported, non-binary source file into the `files` accumulator array.
 */
async function walkDir(dir, baseDir, files) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      await walkDir(fullPath, baseDir, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();

    if (BINARY_EXTENSIONS.has(ext)) {
      continue;
    }

    const language = LANGUAGE_BY_EXT[ext];
    if (!language) {
      // Not one of our supported source languages (yet) — skip.
      continue;
    }

    const relativePath = path.relative(baseDir, fullPath).split(path.sep).join('/');

    try {
      const stat = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      files.push({
        filePath: relativePath,
        language,
        content,
        size: stat.size,
      });
    } catch (err) {
      // e.g. file turned out to be binary despite its extension, or a
      // permissions/race issue. Skip it rather than failing the whole ingest.
      console.warn(`ingestService: skipping unreadable file "${relativePath}": ${err.message}`);
    }
  }
}

/**
 * Clones `repoUrl` into a temp working directory, walks it for supported
 * source files, and returns their contents. Updates the Repository
 * document's status as it progresses (cloning -> parsing), and marks it
 * "failed" (then rethrows) if anything goes wrong.
 *
 * @param {string} repoUrl - Public GitHub repo URL (e.g. https://github.com/owner/name.git)
 * @param {string} repoId - Mongo _id of the corresponding Repository document
 * @returns {Promise<Array<{filePath: string, language: string, content: string, size: number}>>}
 */
export async function ingestRepo(repoUrl, repoId) {
  const workDir = getWorkDir(repoId);

  try {
    await Repository.findByIdAndUpdate(repoId, { status: 'cloning' });
    await cloneRepo(repoUrl, workDir);

    await Repository.findByIdAndUpdate(repoId, { status: 'parsing' });
    const files = [];
    await walkDir(workDir, workDir, files);

    return files;
  } catch (err) {
    try {
      await Repository.findByIdAndUpdate(repoId, { status: 'failed' });
    } catch (updateErr) {
      console.error(`ingestService: failed to mark repo ${repoId} as failed:`, updateErr);
    }
    throw err;
  }
}

/**
 * Runs parserService.parseFile over each raw file collected by ingestRepo,
 * bulk-persists the results as FileRecord documents, and marks the
 * Repository "ready" on success (or "failed" on error).
 *
 * Files whose language parserService doesn't support yet (e.g. typescript,
 * java) simply come back `null` from parseFile and are skipped, not treated
 * as errors.
 *
 * @param {Array<{filePath, language, content, size}>} files - output of ingestRepo
 * @param {string} repoId - Mongo _id of the Repository document
 * @returns {Promise<{filesParsed: number, filesSkipped: number}>}
 */
async function parseAndPersistFiles(files, repoId) {
  const fileRecords = [];

  for (const raw of files) {
    const parsed = await parseFile(raw);
    if (!parsed) continue; // unsupported language or parse failure

    fileRecords.push({
      repoId,
      filePath: parsed.filePath,
      language: parsed.language,
      size: raw.size,
      content: (raw.content ?? '').slice(0, 20000),
      imports: parsed.imports,
      exports: parsed.exports,
      functions: parsed.functions,
      classes: parsed.classes,
    });
  }

  await FileRecord.deleteMany({ repoId });
  if (fileRecords.length > 0) {
    await FileRecord.insertMany(fileRecords, { ordered: false });
  }

  return {
    filesParsed: fileRecords.length,
    filesSkipped: files.length - fileRecords.length,
  };
}

/**
 * Full pipeline: clone + walk (ingestRepo), then parse + persist FileRecords,
 * then mark the Repository "ready". This is what repoController should call
 * after creating the Repository document.
 *
 * @param {string} repoUrl
 * @param {string} repoId
 */
export async function runIngestPipeline(repoUrl, repoId) {
  try {
    const files = await ingestRepo(repoUrl, repoId);
    const { filesParsed, filesSkipped } = await parseAndPersistFiles(files, repoId);
    await buildGraph(repoId);
    await Repository.findByIdAndUpdate(repoId, { status: 'ready' });
    
    return { repoId: String(repoId), filesParsed, filesSkipped };
  } catch (err) {
    try {
      await Repository.findByIdAndUpdate(repoId, { status: 'failed' });
    } catch (updateErr) {
      console.error(`ingestService: failed to mark repo ${repoId} as failed:`, updateErr);
    }
    throw err;
  }
}

export default { ingestRepo, runIngestPipeline };