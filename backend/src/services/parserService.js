// backend/src/services/parserService.js
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';

/**
 * Maps normalized language keys to their Tree-sitter grammar.
 * js/jsx/mjs/cjs all use the JavaScript grammar (which also parses JSX).
 */
const GRAMMARS = {
  js: JavaScript,
  jsx: JavaScript,
  mjs: JavaScript,
  cjs: JavaScript,
  javascript: JavaScript,
  py: Python,
  python: Python,
};

/**
 * Callee names we never want to treat as calls into user-defined code —
 * common language/runtime built-ins for JS and Python. Kept intentionally
 * small: this is a noise filter, not an exhaustive stdlib list.
 */
const SKIP_CALLEES = new Set([
  // JS/TS built-ins
  'console', 'log', 'warn', 'error', 'info', 'debug',
  'require', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'parseInt', 'parseFloat', 'fetch',
  'JSON', 'stringify', 'parse',
  'Object', 'Array', 'isArray',
  'Math', 'Number', 'String', 'Boolean', 'Date', 'Error', 'Promise', 'super',
  // Python built-ins
  'print', 'len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple',
  'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'min', 'max', 'sum', 'abs',
  'open', 'input', 'type', 'isinstance', 'repr', 'format', 'iter', 'next',
  'hasattr', 'getattr', 'setattr', 'vars', 'id', 'hash', 'callable',
]);

// HTTP methods we recognize on Express router/app call expressions.
const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

function normalizeLanguage(language) {
  if (!language) return null;
  return language.toLowerCase().replace(/^\./, '');
}

function getGrammar(language) {
  const key = normalizeLanguage(language);
  return key ? GRAMMARS[key] || null : null;
}

function stripQuotes(text) {
  return text.replace(/^['"`]|['"`]$/g, '');
}

function toRange(name, node) {
  return {
    name,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  };
}

/**
 * Defensive dedupe for a list of function/class entries (as produced by
 * extractJavaScript/extractPython, each `{ name, startLine, endLine, calls }`).
 * Guards against the same declaration ever being recorded twice — e.g. a
 * future extraction path that revisits a node, or a name that gets
 * reassigned/redeclared in a way that maps to the same source location.
 * Two entries are considered the same declaration iff they share both
 * `name` and `startLine`; on collision, their `calls` arrays are merged
 * (union) rather than one copy being silently dropped.
 */
function dedupeEntries(entries) {
  const seen = new Map(); // `${name}::${startLine}` -> entry

  for (const entry of entries) {
    const key = `${entry.name}::${entry.startLine}`;
    const existing = seen.get(key);
    if (existing) {
      const mergedCalls = new Set([...(existing.calls || []), ...(entry.calls || [])]);
      existing.calls = [...mergedCalls];
      // Preserve isComponent if either copy had it set.
      if (entry.isComponent) existing.isComponent = true;
    } else {
      seen.set(key, entry);
    }
  }

  return [...seen.values()];
}

/* ------------------------------------------------------------------ */
/* JavaScript / JSX extraction                                         */
/* ------------------------------------------------------------------ */

/**
 * Recursively checks whether `node`'s subtree contains a JSX element —
 * either a full `jsx_element` (`<div>...</div>`) or a self-closing one
 * (`<Foo />`). Used to decide whether a function's body renders JSX,
 * which is our signal for "this is a React component".
 */
function containsJSX(node) {
  if (!node) return false;
  if (node.type === 'jsx_element' || node.type === 'jsx_self_closing_element') {
    return true;
  }
  for (const child of node.namedChildren) {
    if (containsJSX(child)) return true;
  }
  return false;
}

function startsWithUppercase(name) {
  return /^[A-Z]/.test(name);
}

/**
 * Detects Express-style route registrations: `router.get(...)`,
 * `app.post(...)`, etc. — a call_expression whose callee is a
 * member_expression `<router|app>.<httpMethod>`, whose first argument is a
 * string literal (the route path).
 * Returns `{ method, path }` (method upper-cased) or null if this call
 * doesn't match that shape.
 */
function getExpressRouteInfo(node) {
  const fnNode = node.childForFieldName('function');
  if (!fnNode || fnNode.type !== 'member_expression') return null;

  const objectNode = fnNode.childForFieldName('object');
  const propertyNode = fnNode.childForFieldName('property');
  if (!objectNode || !propertyNode) return null;

  const objectName = objectNode.text;
  const methodName = propertyNode.text;
  if ((objectName !== 'router' && objectName !== 'app') || !HTTP_METHODS.has(methodName)) {
    return null;
  }

  const argsNode = node.childForFieldName('arguments');
  const firstArg = argsNode?.namedChild(0);
  if (!firstArg || firstArg.type !== 'string') return null;

  return { method: methodName.toUpperCase(), path: stripQuotes(firstArg.text) };
}

/**
 * Detects Mongoose model registrations, matching either:
 *   - `mongoose.model('Name', schema)`   (member_expression callee)
 *   - `model('Name', schema)`            (bare identifier, this project's
 *     own model files destructure `const { Schema, model } = mongoose;`
 *     and call `model(...)` directly)
 * Returns the model name string, or null if this call doesn't match.
 */
function getMongooseModelName(node) {
  const fnNode = node.childForFieldName('function');
  if (!fnNode) return null;

  let isModelCall = false;
  if (fnNode.type === 'identifier' && fnNode.text === 'model') {
    isModelCall = true;
  } else if (fnNode.type === 'member_expression') {
    const objectNode = fnNode.childForFieldName('object');
    const propertyNode = fnNode.childForFieldName('property');
    if (objectNode?.text === 'mongoose' && propertyNode?.text === 'model') {
      isModelCall = true;
    }
  }
  if (!isModelCall) return null;

  const argsNode = node.childForFieldName('arguments');
  const firstArg = argsNode?.namedChild(0);
  if (!firstArg || firstArg.type !== 'string') return null;

  return stripQuotes(firstArg.text);
}

function handleExportStatement(node, result) {
  const isDefault = node.children.some((c) => c.type === 'default');
  if (isDefault) {
    result.exports.push('default');
    return;
  }

  const declarationNode = node.childForFieldName('declaration');
  if (declarationNode) {
    switch (declarationNode.type) {
      case 'function_declaration':
      case 'generator_function_declaration':
      case 'class_declaration': {
        const nameNode = declarationNode.childForFieldName('name');
        if (nameNode) result.exports.push(nameNode.text);
        break;
      }
      case 'lexical_declaration':
      case 'variable_declaration': {
        for (const declarator of declarationNode.namedChildren) {
          if (declarator.type !== 'variable_declarator') continue;
          const nameNode = declarator.childForFieldName('name');
          if (nameNode) result.exports.push(nameNode.text);
        }
        break;
      }
      default:
        break;
    }
    return;
  }

  // export { a, b as c } [from '...']
  const exportClause = node.namedChildren.find((c) => c.type === 'export_clause');
  if (exportClause) {
    for (const specifier of exportClause.namedChildren) {
      if (specifier.type !== 'export_specifier') continue;
      const aliasNode = specifier.childForFieldName('alias');
      const nameNode = specifier.childForFieldName('name');
      const exportedName = aliasNode ? aliasNode.text : nameNode ? nameNode.text : null;
      if (exportedName) result.exports.push(exportedName);
    }
  }
}

/**
 * Resolves a call_expression's `function` field down to a plain callee
 * name we can match against known function/class names.
 *   foo()          (identifier)        -> "foo"
 *   obj.foo()       (member_expression) -> "foo"
 *   this.foo()       (member_expression) -> "foo"
 * Anything else (computed member access, IIFEs, etc.) returns null and is
 * skipped — we only want simple, matchable callee names.
 */
function getJsCalleeName(fnNode) {
  if (!fnNode) return null;
  if (fnNode.type === 'identifier') return fnNode.text;
  if (fnNode.type === 'member_expression') {
    const propertyNode = fnNode.childForFieldName('property');
    return propertyNode ? propertyNode.text : null;
  }
  return null;
}

function extractJavaScript(root, result) {
  // Stack of currently-open function/class entry objects (the same objects
  // pushed into result.functions / result.classes). A call_expression found
  // anywhere inside a scope's body — including inside nested scopes — is
  // recorded on every currently-open entry, matching "collect callee names
  // found within that function/class's body range".
  const scopeStack = [];

  function addCall(calleeName) {
    if (!calleeName || SKIP_CALLEES.has(calleeName)) return;
    for (const scope of scopeStack) {
      if (!scope.calls.includes(calleeName)) scope.calls.push(calleeName);
    }
  }

  function walk(node) {
    let pushedScope = null;

    switch (node.type) {
      case 'import_statement': {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) result.imports.push(stripQuotes(sourceNode.text));
        break;
      }
      case 'call_expression': {
        const fnNode = node.childForFieldName('function');

        // CommonJS interop: require('...')
        if (fnNode && fnNode.text === 'require') {
          const argsNode = node.childForFieldName('arguments');
          const arg = argsNode?.namedChild(0);
          if (arg && arg.type === 'string') {
            result.imports.push(stripQuotes(arg.text));
          }
        }

        // Express route detection: router.get/post/put/delete/patch(...) or app.<method>(...)
        const routeInfo = getExpressRouteInfo(node);
        if (routeInfo) result.apiRoutes.push(routeInfo);

        // Mongoose model detection: mongoose.model('Name', schema) or bare model('Name', schema)
        const modelName = getMongooseModelName(node);
        if (modelName) result.dbModels.push(modelName);

        addCall(getJsCalleeName(fnNode));
        break;
      }
      case 'export_statement': {
        handleExportStatement(node, result);
        break;
      }
      case 'function_declaration':
      case 'generator_function_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const entry = toRange(nameNode.text, node);
          entry.calls = [];
          // React component detection: uppercase name + JSX somewhere in the body.
          if (startsWithUppercase(nameNode.text)) {
            const bodyNode = node.childForFieldName('body');
            if (containsJSX(bodyNode)) entry.isComponent = true;
          }
          result.functions.push(entry);
          pushedScope = entry;
        }
        break;
      }
      case 'class_declaration': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const entry = toRange(nameNode.text, node);
          entry.calls = [];
          result.classes.push(entry);
          pushedScope = entry;
        }
        break;
      }
      case 'lexical_declaration':
      case 'variable_declaration': {
        // const foo = () => {} / const foo = function () {}
        for (const declarator of node.namedChildren) {
          if (declarator.type !== 'variable_declarator') continue;
          const nameNode = declarator.childForFieldName('name');
          const valueNode = declarator.childForFieldName('value');
          if (!nameNode || !valueNode) continue;
          if (
            valueNode.type === 'arrow_function' ||
            valueNode.type === 'function' ||
            valueNode.type === 'function_expression'
          ) {
            const entry = toRange(nameNode.text, node);
            entry.calls = [];
            // React component detection: uppercase name + JSX in the arrow/function body.
            // Covers both block bodies (`=> { return <div/> }`) and implicit-return
            // JSX bodies (`=> <div/>`), since containsJSX checks the node itself first.
            if (startsWithUppercase(nameNode.text)) {
              const bodyNode = valueNode.childForFieldName('body');
              if (containsJSX(bodyNode)) entry.isComponent = true;
            }
            result.functions.push(entry);
            // If a single statement declares multiple function-valued
            // bindings (rare), the last one wins for scope attribution —
            // an acceptable simplification, consistent with toRange()
            // already using the whole statement's range for each.
            pushedScope = entry;
          }
        }
        break;
      }
      default:
        break;
    }

    if (pushedScope) scopeStack.push(pushedScope);
    for (const child of node.namedChildren) walk(child);
    if (pushedScope) scopeStack.pop();
  }

  walk(root);
}

/* ------------------------------------------------------------------ */
/* Python extraction                                                   */
/* ------------------------------------------------------------------ */

function collectPythonImportName(node, result) {
  if (node.type === 'dotted_name') {
    result.imports.push(node.text);
  } else if (node.type === 'aliased_import') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) result.imports.push(nameNode.text);
  }
}

/**
 * Given an `import_from_statement` node's `name`-field child (the part
 * after `import`), resolve the plain imported identifier text.
 * Handles the two shapes Tree-sitter's Python grammar produces:
 *   - dotted_name          -> "deps" (or "pkg.sub" for dotted imports)
 *   - aliased_import       -> "deps" (from "deps as d"; alias is ignored,
 *                             we want the real imported name, not the alias)
 * wildcard_import ("from x import *") has no discrete name and is skipped.
 */
function resolvePythonImportedName(nameNode) {
  if (!nameNode) return null;
  if (nameNode.type === 'dotted_name') {
    return nameNode.text;
  }
  if (nameNode.type === 'aliased_import') {
    const innerNameNode = nameNode.childForFieldName('name');
    return innerNameNode ? innerNameNode.text : null;
  }
  return null;
}

// Python has no explicit export syntax. We approximate "exports" as
// module-scope (top-level) function/class definitions, plus anything
// explicitly listed in __all__.
function isModuleScope(node) {
  return node.parent && node.parent.type === 'module';
}

/**
 * Resolves a Python `call` node's `function` field down to a plain callee
 * name we can match against known function/class names.
 *   foo()             (identifier) -> "foo"
 *   obj.foo()          (attribute)  -> "foo"
 *   self.foo() / cls.foo()          -> "foo"
 * Anything else (subscript calls, etc.) returns null and is skipped.
 */
function getPyCalleeName(fnNode) {
  if (!fnNode) return null;
  if (fnNode.type === 'identifier') return fnNode.text;
  if (fnNode.type === 'attribute') {
    const attributeNode = fnNode.childForFieldName('attribute');
    return attributeNode ? attributeNode.text : null;
  }
  return null;
}

function extractPython(root, result) {
  // Same "currently-open scopes" approach as extractJavaScript — see there
  // for the rationale.
  const scopeStack = [];

  function addCall(calleeName) {
    if (!calleeName || SKIP_CALLEES.has(calleeName)) return;
    for (const scope of scopeStack) {
      if (!scope.calls.includes(calleeName)) scope.calls.push(calleeName);
    }
  }

  function walk(node) {
    let pushedScope = null;

    switch (node.type) {
      case 'import_statement': {
        for (const child of node.namedChildren) {
          collectPythonImportName(child, result);
        }
        break;
      }
      case 'import_from_statement': {
        const moduleNode = node.childForFieldName('module_name');
        if (moduleNode) {
          // Keep the plain module path (existing behavior), e.g. "app.api"
          result.imports.push(moduleNode.text);

          // Also capture each imported name from the `name` field
          // (there can be several, e.g. "from app.api import deps, other"),
          // and record combined specifiers like "app.api.deps" so
          // graphBuilderService can resolve them to app/api/deps.py.
          //
          // NOTE: the imported name here is NOT guaranteed to be a
          // submodule — for `from backend.agents.narrator import NarratorAgent`
          // this produces "backend.agents.narrator.NarratorAgent", where
          // "NarratorAgent" is a class defined inside narrator.py, not a
          // submodule/package of its own. We deliberately still record it:
          // graphBuilderService.resolvePythonModuleImport() tries every
          // dotted prefix of the specifier (longest first), so it correctly
          // falls back to resolving "backend/agents/narrator.py" once it
          // peels "NarratorAgent" off the end. Keeping both the plain and
          // combined form here means callers importing either a submodule
          // or a symbol from a module both resolve correctly on the
          // graphBuilderService side, without parserService needing to
          // guess which case it is.
          const nameNodes =
            typeof node.childrenForFieldName === 'function'
              ? node.childrenForFieldName('name')
              : node.namedChildren.filter(
                  (c) => c !== moduleNode && c.type !== 'wildcard_import'
                );

          for (const nameNode of nameNodes) {
            const importedName = resolvePythonImportedName(nameNode);
            if (importedName) {
              result.imports.push(`${moduleNode.text}.${importedName}`);
            }
          }
        }
        break;
      }
      case 'call': {
        const fnNode = node.childForFieldName('function');
        addCall(getPyCalleeName(fnNode));
        break;
      }
      case 'function_definition': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const entry = toRange(nameNode.text, node);
          entry.calls = [];
          result.functions.push(entry);
          if (isModuleScope(node)) result.exports.push(nameNode.text);
          pushedScope = entry;
        }
        break;
      }
      case 'class_definition': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const entry = toRange(nameNode.text, node);
          entry.calls = [];
          result.classes.push(entry);
          if (isModuleScope(node)) result.exports.push(nameNode.text);
          pushedScope = entry;
        }
        break;
      }
      case 'assignment': {
        const leftNode = node.childForFieldName('left');
        const rightNode = node.childForFieldName('right');
        if (leftNode?.text === '__all__' && rightNode?.type === 'list') {
          for (const el of rightNode.namedChildren) {
            if (el.type === 'string') result.exports.push(stripQuotes(el.text));
          }
        }
        break;
      }
      default:
        break;
    }

    if (pushedScope) scopeStack.push(pushedScope);
    for (const child of node.namedChildren) walk(child);
    if (pushedScope) scopeStack.pop();
  }

  walk(root);
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/**
 * Parses a single file's content with Tree-sitter and extracts a
 * FileRecord-shaped summary (imports/exports/functions/classes, each
 * function/class carrying a `calls` array of callee names found in its
 * body; JS/JSX files additionally get `apiRoutes` and `dbModels`, and
 * component-like functions get `isComponent: true`).
 *
 * @param {Object} params
 * @param {string} params.filePath - repo-relative file path
 * @param {string} params.language - e.g. 'js', 'jsx', 'py'
 * @param {string} params.content - raw file contents
 * @returns {Promise<Object|null>} FileRecord-shaped object, or null if
 *   the language is unsupported or parsing fails.
 */
export async function parseFile({ filePath, language, content }) {
  const grammar = getGrammar(language);
  if (!grammar) {
    return null;
  }

  const parser = new Parser();
  parser.setLanguage(grammar);

  let tree;
  try {
    tree = parser.parse(content ?? '');
  } catch (err) {
    console.error(`[parserService] Failed to parse ${filePath}: ${err.message}`);
    return null;
  }

  const result = {
    filePath,
    language,
    size: Buffer.byteLength(content ?? '', 'utf8'),
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    apiRoutes: [],
    dbModels: [],
  };

  if (grammar === Python) {
    extractPython(tree.rootNode, result);
  } else {
    extractJavaScript(tree.rootNode, result);
  }

  // Defensive: ensure no function/class was recorded twice for the same
  // declaration (same name + startLine) before this record ever reaches
  // graphBuilderService.
  result.functions = dedupeEntries(result.functions);
  result.classes = dedupeEntries(result.classes);

  result.imports = [...new Set(result.imports)];
  result.exports = [...new Set(result.exports)];

  // Dedupe apiRoutes by method+path, and dbModels by name — the same
  // route/model can otherwise be recorded more than once if a scope is
  // revisited or a helper re-registers the same call.
  const seenRoutes = new Set();
  result.apiRoutes = result.apiRoutes.filter((route) => {
    const key = `${route.method} ${route.path}`;
    if (seenRoutes.has(key)) return false;
    seenRoutes.add(key);
    return true;
  });
  result.dbModels = [...new Set(result.dbModels)];

  return result;
}

export default { parseFile };