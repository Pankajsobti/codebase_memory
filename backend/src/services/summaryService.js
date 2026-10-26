import Groq from 'groq-sdk';
import FileRecord from '../models/FileRecord.js';
import env from '../config/env.js';

const groq = new Groq({
  apiKey: env.groqApiKey,
});

const MODEL = 'openai/gpt-oss-120b';
const MAX_CONTEXT_FILES = 30;
const MAX_CONTEXT_CHARS = 8000;

function truncate(str, maxChars) {
  if (str.length <= maxChars) return str;
  return `${str.slice(0, maxChars)}\n...(context truncated)`;
}

function buildLanguageBreakdown(fileRecords) {
  const counts = {};
  for (const f of fileRecords) {
    const lang = f.language || 'unknown';
    counts[lang] = (counts[lang] || 0) + 1;
  }
  return counts;
}

function computeAvgFunctionsPerFile(fileRecords) {
  if (!fileRecords.length) return 0;
  const totalFunctions = fileRecords.reduce(
    (sum, f) => sum + (f.functions?.length || 0),
    0
  );
  return Number((totalFunctions / fileRecords.length).toFixed(2));
}

function buildFileContext(fileRecords) {
  return fileRecords
    .slice(0, MAX_CONTEXT_FILES)
    .map((f) => {
      const imports = (f.imports || []).join(', ') || 'none';
      const exports = (f.exports || []).join(', ') || 'none';
      return `File: ${f.filePath} (${f.language || 'unknown'})\n  Imports: ${imports}\n  Exports: ${exports}`;
    })
    .join('\n\n');
}

export async function getRepoSummary(repoId) {
  const fileRecords = await FileRecord.find({ repoId }).lean();

  const languageBreakdown = buildLanguageBreakdown(fileRecords);
  const totalFiles = fileRecords.length;
  const avgFunctionsPerFile = computeAvgFunctionsPerFile(fileRecords);

  if (!totalFiles) {
    return {
      languageBreakdown,
      totalFiles,
      avgFunctionsPerFile,
      aiSummary: 'No files have been indexed for this repository yet.',
    };
  }

  let context = [
    '## Language breakdown',
    Object.entries(languageBreakdown)
      .map(([lang, count]) => `${lang}: ${count} file(s)`)
      .join('\n'),
    '',
    '## Files (imports/exports)',
    buildFileContext(fileRecords),
  ].join('\n');

  context = truncate(context, MAX_CONTEXT_CHARS);

  const systemPrompt = [
    'You are a codebase architecture assistant. Using ONLY the context below, which was',
    'extracted from static analysis of a repository (file languages, imports, exports),',
    'write a concise 2-3 sentence summary of the overall architecture: what kind of',
    'project this looks like, the main languages/frameworks in use, and how the pieces',
    'appear to relate based on imports/exports. Do not invent details not supported by',
    'the context.',
    '',
    context,
  ].join('\n');

  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Summarize this codebase architecture.' },
    ],
  });

  const aiSummary = response.choices[0].message.content.trim();

  return {
    languageBreakdown,
    totalFiles,
    avgFunctionsPerFile,
    aiSummary,
  };
}

export default { getRepoSummary };