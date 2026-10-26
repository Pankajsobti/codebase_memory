import path from 'path';
import FileRecord from '../models/FileRecord.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import Repository from '../models/Repository.js';

const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const INDEX_FILES = CODE_EXTENSIONS.map((ext) => `index${ext}`);

// --- Python support additions ---
const PYTHON_EXTENSIONS = ['.py'];
const PYTHON_INDEX_FILES = ['__init__.py'];

function isRelativeImport(importSpecifier) {
  return importSpecifier.startsWith('./') || importSpecifier.startsWith('../');
}

/**
 * Matches "bare" dotted Python module specifiers such as "ChatBot.data_loader"
 * or a single-segment "data_loader" — i.e. identifiers joined by dots, with no
 * leading dot (leading dot = relative import, handled elsewhere) and no slash.
 * This is how parserService.js is expected to record non-relative Python
 * imports (e.g. "from ChatBot import data_loader" -> "ChatBot.data_loader").
 *
 * Verified against parserService.js: for `import_from_statement`, both the
 * plain module path (e.g. "backend.agents.narrator") and a combined
 * "module.importedName" specifier (e.g. "backend.agents.narrator.NarratorAgent")
 * are pushed into `imports`, and both are plain dotted identifiers with no
 * leading dot — so both correctly match this regex and both get routed to
 * resolvePythonModuleImport() below via resolveFileImport(). Nothing here
 * silently drops them.
 */
function isDottedPythonSpecifier(importSpecifier) {
  return /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(importSpecifier);
}

/**
 * Normalizes a repo-relative file path so that paths coming from different
 * sources (DB-stored FileRecord.filePath vs. freshly-computed candidate
 * paths built from an import specifier) can be safely compared for
 * equality, regardless of:
 *   - backslashes vs. forward slashes (e.g. if any upstream ingestion step
 *     ever used an OS-native path.join on Windows)
 *   - a leading "./" or leading "/"
 *   - a trailing "/"
 *   - incidental leading/trailing whitespace
 * This does NOT lowercase by default, since Python module/package names are
 * case-sensitive on Linux/macOS filesystems (and repos are usually ingested
 * from a case-sensitive source like GitHub) — case mismatches are much more
 * likely to indicate a real bug elsewhere than something to paper over here.
 */
function normalizeFilePath(filePath) {
  return filePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * Builds a lookup index from every known FileRecord.filePath for this repo,
 * keyed by its normalized form, mapping back to the original (un-normalized)
 * filePath string. The original string is what we must return from the
 * resolve*() functions below, since it's what's used verbatim as the file
 * node's nodeId elsewhere in buildGraph() — resolving to a normalized form
 * that doesn't exactly match an existing nodeId would silently break edges.
 */
function buildFilePathIndex(fileRecords) {
  const index = new Map(); // normalizedPath -> original filePath
  for (const record of fileRecords) {
    const normalized = normalizeFilePath(record.filePath);
    if (!index.has(normalized)) {
      index.set(normalized, record.filePath);
    }
  }
  return index;
}

/**
 * Looks up a single candidate path against the normalized file path index.
 * Returns the original (un-normalized) filePath on a match, or null.
 */
function lookupCandidate(candidate, filePathIndex) {
  const resolved = filePathIndex.get(normalizeFilePath(candidate));
  return resolved !== undefined ? resolved : null;
}

/**
 * Resolves a relative import specifier (written inside `importingFilePath`)
 * against the set of known FileRecord.filePath values for this repo.
 * Tries: exact match, common extensions appended (JS/TS + Python), and
 * index files inside a matched directory (JS index.* + Python __init__.py).
 * Returns null if nothing resolves (e.g. node_modules, aliases, or files we
 * didn't ingest).
 */
function resolveImportPath(importingFilePath, importSpecifier, filePathIndex) {
  const dir = path.posix.dirname(importingFilePath);
  const rawResolved = path.posix.normalize(path.posix.join(dir, importSpecifier));

  const candidates = [rawResolved];
  for (const ext of CODE_EXTENSIONS) {
    candidates.push(`${rawResolved}${ext}`);
  }
  for (const indexFile of INDEX_FILES) {
    candidates.push(path.posix.join(rawResolved, indexFile));
  }
  // Python: try appending .py, and matching __init__.py inside the resolved dir
  for (const ext of PYTHON_EXTENSIONS) {
    candidates.push(`${rawResolved}${ext}`);
  }
  for (const indexFile of PYTHON_INDEX_FILES) {
    candidates.push(path.posix.join(rawResolved, indexFile));
  }

  for (const candidate of candidates) {
    const resolved = lookupCandidate(candidate, filePathIndex);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Resolves a non-relative, dotted Python module specifier (e.g.
 * "backend.agents.narrator" or "backend.agents.narrator.NarratorAgent")
 * against known FileRecord.filePath values.
 *
 * Python absolute imports resolve from the source root, so we convert dots
 * to path separators. We try every PREFIX of the dotted path, longest first
 * — not just the full specifier as a single path. This is necessary because
 * parserService.js records both:
 *   - the plain module path            "backend.agents.narrator"
 *   - a combined "module.symbol" form  "backend.agents.narrator.NarratorAgent"
 * and there's no way to tell from the specifier alone which trailing
 * segment(s) are actual package/module path components vs. an imported
 * symbol name (class/function) that lives inside the last module segment.
 * Trying the full path first, then progressively shorter prefixes, means we
 * find "backend/agents/narrator.py" for both specifiers above — the second
 * one simply matches on its second-to-last-prefix attempt instead of its
 * first.
 */
function resolvePythonModuleImport(importSpecifier, filePathIndex) {
  const segments = importSpecifier.split('.');

  for (let i = segments.length; i >= 1; i--) {
    const asPath = segments.slice(0, i).join('/');

    const candidates = [asPath];
    for (const ext of PYTHON_EXTENSIONS) {
      candidates.push(`${asPath}${ext}`);
    }
    for (const indexFile of PYTHON_INDEX_FILES) {
      candidates.push(path.posix.join(asPath, indexFile));
    }

    for (const candidate of candidates) {
      const resolved = lookupCandidate(candidate, filePathIndex);
      if (resolved) return resolved;
    }
  }

  return null;
}

function isPythonFile(filePath) {
  return filePath.endsWith('.py');
}

/**
 * Resolves a single import specifier written inside `file.filePath` to a
 * known FileRecord.filePath, or null if it doesn't resolve (external
 * package, alias, stdlib, unresolved path, etc.). Shared by the file-level
 * dependency pass and the calls-edge pass (which needs to know which other
 * files a given file can call into).
 */
function resolveFileImport(file, importSpecifier, filePathIndex) {
  if (isRelativeImport(importSpecifier)) {
    return resolveImportPath(file.filePath, importSpecifier, filePathIndex);
  }
  if (isPythonFile(file.filePath) && isDottedPythonSpecifier(importSpecifier)) {
    return resolvePythonModuleImport(importSpecifier, filePathIndex);
  }
  return null;
}

/**
 * Builds and persists the dependency graph (file -> file, via imports) and
 * the function/class/component/apiRoute/dbModel nodes used by the graph
 * views, for a given repo. Idempotent: clears any existing GraphNode/
 * GraphEdge docs for this repoId before inserting fresh ones.
 */
export async function buildGraph(repoId) {
  const fileRecords = await FileRecord.find({ repoId }).lean();
  const filePathIndex = buildFilePathIndex(fileRecords);

  const nodes = [];
  const edges = [];
  const edgeKeys = new Set(); // dedupe: `${type}|${source}|${target}`

  function pushEdge(source, target, type) {
    const key = `${type}|${source}|${target}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ repoId, source, target, type });
  }

  // Tracks, per file, which other files it resolves imports into — reused
  // below when resolving call edges across file boundaries.
  const importedFilesByFile = new Map(); // filePath -> Set<filePath>

  // --- File-level dependency graph ---
  for (const file of fileRecords) {
    nodes.push({
      repoId,
      nodeId: file.filePath,
      type: 'file',
      label: file.filePath,
      filePath: file.filePath,
    });

    const resolvedImports = new Set();
    const imports = file.imports || [];
    for (const importSpecifier of imports) {
      const resolvedTarget = resolveFileImport(file, importSpecifier, filePathIndex);
      if (!resolvedTarget) {
        // Unresolved import (path alias, missing file, external package, etc.) — skip
        continue;
      }

      resolvedImports.add(resolvedTarget);
      pushEdge(file.filePath, resolvedTarget, 'imports');
    }
    importedFilesByFile.set(file.filePath, resolvedImports);
  }

  // --- Function/class/component nodes for the call graph, plus apiRoute/dbModel nodes ---
  // nodeId is `${filePath}::${name}::${startLine}` so that two functions/
  // classes with the same name in the same file (overloads, duplicate-named
  // declarations across merged parse passes, etc.) never collide.
  //
  // nodeIdsByFileAndName: filePath -> Map<name, nodeId[]>. A name can map to
  // more than one nodeId when a file declares the same name more than once
  // (e.g. overloaded/duplicate-named functions) — call-edge resolution below
  // links to every matching node in that case, rather than guessing.
  const nodeIdsByFileAndName = new Map();

  for (const file of fileRecords) {
    const namesMap = nodeIdsByFileAndName.get(file.filePath) || new Map();

    for (const fn of file.functions || []) {
      const nodeId = `${file.filePath}::${fn.name}::${fn.startLine}`;
      nodes.push({
        repoId,
        nodeId,
        // React components are still functions for call-edge purposes,
        // but get their own node type so the graph/legend can distinguish them.
        type: fn.isComponent ? 'component' : 'function',
        label: fn.name,
        filePath: file.filePath,
        metadata: { startLine: fn.startLine, endLine: fn.endLine },
      });
      const existing = namesMap.get(fn.name) || [];
      existing.push(nodeId);
      namesMap.set(fn.name, existing);
    }

    for (const cls of file.classes || []) {
      const nodeId = `${file.filePath}::${cls.name}::${cls.startLine}`;
      nodes.push({
        repoId,
        nodeId,
        type: 'class',
        label: cls.name,
        filePath: file.filePath,
        metadata: { startLine: cls.startLine, endLine: cls.endLine },
      });
      const existing = namesMap.get(cls.name) || [];
      existing.push(nodeId);
      namesMap.set(cls.name, existing);
    }

    // Express API route nodes — one per {method, path} entry recorded on this file.
    for (const route of file.apiRoutes || []) {
      const nodeId = `${file.filePath}::route::${route.method}:${route.path}`;
      nodes.push({
        repoId,
        nodeId,
        type: 'apiRoute',
        label: `${route.method} ${route.path}`,
        filePath: file.filePath,
        metadata: { method: route.method, path: route.path },
      });
    }

    // Mongoose DB model nodes — one per model name recorded on this file.
    for (const modelName of file.dbModels || []) {
      const nodeId = `${file.filePath}::model::${modelName}`;
      nodes.push({
        repoId,
        nodeId,
        type: 'dbModel',
        label: modelName,
        filePath: file.filePath,
      });
    }

    nodeIdsByFileAndName.set(file.filePath, namesMap);
  }

  // --- Call-edge resolution ---
  // For each function/class's recorded `calls` (callee names collected by
  // parserService while walking that scope's body), try to resolve the
  // callee to known function/class node(s):
  //   1. Same file: any nodeId(s) registered under `calleeName` for this file
  //   2. Any file this file has an "imports" edge to, that declares a
  //      function/class named `calleeName`
  // If a name resolves to multiple nodeIds (duplicate-named declarations in
  // the same file), an edge is pushed to each — ambiguous but complete,
  // rather than silently picking one.
  // Unresolved callees (external libs, builtins that slipped the skip-list,
  // dynamic dispatch, etc.) are silently skipped.
  for (const file of fileRecords) {
    const importedFiles = importedFilesByFile.get(file.filePath) || new Set();
    const entries = [...(file.functions || []), ...(file.classes || [])];

    for (const entry of entries) {
      const sourceNodeId = `${file.filePath}::${entry.name}::${entry.startLine}`;

      for (const calleeName of entry.calls || []) {
        // 1. Same-file match
        const sameFileTargets = nodeIdsByFileAndName.get(file.filePath)?.get(calleeName);
        if (sameFileTargets && sameFileTargets.length > 0) {
          for (const target of sameFileTargets) {
            pushEdge(sourceNodeId, target, 'calls');
          }
          continue;
        }

        // 2. Match against any file this file imports
        let resolved = false;
        for (const importedFilePath of importedFiles) {
          const targets = nodeIdsByFileAndName.get(importedFilePath)?.get(calleeName);
          if (targets && targets.length > 0) {
            for (const target of targets) {
              pushEdge(sourceNodeId, target, 'calls');
            }
            resolved = true;
            break;
          }
        }

        // Unresolved (external/builtin/dynamic) — nothing to link to, skip.
        if (!resolved) continue;
      }
    }
  }

  await GraphNode.deleteMany({ repoId });
  await GraphEdge.deleteMany({ repoId });

  if (nodes.length > 0) {
    await GraphNode.insertMany(nodes);
  }
  if (edges.length > 0) {
    await GraphEdge.insertMany(edges);
  }

  await Repository.findByIdAndUpdate(repoId, { status: 'ready' });

  return { nodeCount: nodes.length, edgeCount: edges.length };
}

export default { buildGraph };