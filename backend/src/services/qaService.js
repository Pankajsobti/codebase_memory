import Groq from 'groq-sdk';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import FileRecord from '../models/FileRecord.js';
import env from '../config/env.js';

const groq = new Groq({
  apiKey: env.groqApiKey,
});

const MAX_CONTEXT_NODES = 40;
const MAX_CONTEXT_FILES = 12;
const MAX_CONTEXT_CHARS = 12000;
const MODEL = 'openai/gpt-oss-120b';

function tokenize(text = '') {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []);
}

function relevanceScore(questionTokens, text) {
  const tokens = new Set(tokenize(text));
  let score = 0;
  for (const t of questionTokens) {
    if (tokens.has(t)) score += 1;
  }
  return score;
}

function rankNodes(nodes, questionTokens) {
  return nodes
    .map((node) => ({
      node,
      score: relevanceScore(
        questionTokens,
        `${node.label} ${node.filePath || ''} ${node.type}`
      ),
    }))
    .sort((a, b) => b.score - a.score);
}

function rankFiles(files, questionTokens) {
  return files
    .map((file) => {
      const fnNames = (file.functions || []).map((f) => f.name).join(' ');
      const classNames = (file.classes || []).map((c) => c.name).join(' ');
      const text = `${file.filePath} ${fnNames} ${classNames} ${(file.imports || []).join(' ')} ${(file.exports || []).join(' ')}`;
      return { file, score: relevanceScore(questionTokens, text) };
    })
    .sort((a, b) => b.score - a.score);
}

function buildFileContext(fileRecords) {
  return fileRecords
    .map((f) => {
      const fns = (f.functions || []).map((fn) => fn.name).join(', ') || 'none';
      const classes = (f.classes || []).map((c) => c.name).join(', ') || 'none';
      const imports = (f.imports || []).join(', ') || 'none';
      const exports = (f.exports || []).join(', ') || 'none';
      return [
        `File: ${f.filePath} (${f.language || 'unknown'})`,
        `  Functions: ${fns}`,
        `  Classes: ${classes}`,
        `  Imports: ${imports}`,
        `  Exports: ${exports}`,
      ].join('\n');
    })
    .join('\n\n');
}

function buildRelationshipContext(edges, nodesById) {
  if (!edges.length) return 'No known relationships among the relevant nodes.';
  return edges
    .map((e) => {
      const source = nodesById.get(e.source);
      const target = nodesById.get(e.target);
      const sourceLabel = source ? source.label : e.source;
      const targetLabel = target ? target.label : e.target;
      return `${sourceLabel} --${e.type}--> ${targetLabel}`;
    })
    .join('\n');
}

function truncate(str, maxChars) {
  if (str.length <= maxChars) return str;
  return `${str.slice(0, maxChars)}\n...(context truncated)`;
}

export async function answerQuestion(repoId, question) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('question is required');
  }

  const questionTokens = tokenize(question);

  const nodes = await GraphNode.find({ repoId }).lean();
  if (!nodes.length) {
    return {
      answer:
        "I don't have any indexed graph data for this repository yet. Try again once ingestion/parsing has completed.",
      relevantNodes: [],
    };
  }

  const rankedNodes = rankNodes(nodes, questionTokens);
  const hasNodeSignal = rankedNodes[0]?.score > 0;
  const topNodes = (hasNodeSignal
    ? rankedNodes.filter((r) => r.score > 0)
    : rankedNodes
  )
    .slice(0, MAX_CONTEXT_NODES)
    .map((r) => r.node);

  const relevantFilePaths = [
    ...new Set(topNodes.map((n) => n.filePath).filter(Boolean)),
  ].slice(0, MAX_CONTEXT_FILES);

  let fileRecords = [];
  if (relevantFilePaths.length) {
    fileRecords = await FileRecord.find({
      repoId,
      filePath: { $in: relevantFilePaths },
    }).lean();
  } else {
    const allFiles = await FileRecord.find({ repoId }).lean();
    fileRecords = rankFiles(allFiles, questionTokens)
      .slice(0, MAX_CONTEXT_FILES)
      .map((r) => r.file);
  }

  const relevantNodeIds = topNodes.map((n) => n.nodeId);
  const nodesById = new Map(nodes.map((n) => [n.nodeId, n]));

  const edges = await GraphEdge.find({
    repoId,
    $or: [
      { source: { $in: relevantNodeIds } },
      { target: { $in: relevantNodeIds } },
    ],
  })
    .limit(100)
    .lean();

  const nodeListContext = topNodes
    .map((n) => `- [${n.type}] ${n.label} (${n.filePath || 'n/a'})`)
    .join('\n');
  const fileContext = buildFileContext(fileRecords);
  const relationshipContext = buildRelationshipContext(edges, nodesById);

  let context = [
    '## Relevant nodes',
    nodeListContext || 'None found.',
    '',
    '## Relevant files',
    fileContext || 'None found.',
    '',
    '## Relationships',
    relationshipContext,
  ].join('\n');

  context = truncate(context, MAX_CONTEXT_CHARS);

  const systemPrompt = [
    'You are a codebase architecture assistant. Answer the question using ONLY the',
    'context provided below, which was extracted from a static analysis graph of a',
    'repository (files, functions, classes, and their relationships).',
    'Do not invent files, functions, or relationships that are not present in the context.',
    'If the context is insufficient to answer confidently, say so explicitly.',
    'Always name specific files and/or functions/classes when relevant to support your answer.',
    'Be concise and technical.',
    '',
    context,
  ].join('\n');

  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
  });

  const answer = response.choices[0].message.content.trim();

  return {
    answer,
    relevantNodes: relevantNodeIds,
  };
}