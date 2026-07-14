#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vercel']);
const excludedPaths = new Set(['.agents/skills']);
const markdownFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    const repositoryPath = relative(root, absolutePath).split(sep).join('/');
    if (
      entry.isDirectory() &&
      (excludedDirectories.has(entry.name) || excludedPaths.has(repositoryPath))
    ) {
      continue;
    }
    if (entry.isDirectory()) walk(absolutePath);
    else if (entry.isFile() && entry.name.endsWith('.md')) markdownFiles.push(absolutePath);
  }
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1).trim();
  const titleMatch = target.match(/^(\S+)(?:\s+["'(].*)?$/);
  if (titleMatch) target = titleMatch[1];
  return target;
}

function shouldIgnore(target) {
  return (
    target === '' ||
    target.startsWith('#') ||
    target.startsWith('/') ||
    /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target) ||
    target.includes('{{') ||
    target.includes('${')
  );
}

function validateTarget(file, source, index, rawTarget, failures) {
  const target = normalizeTarget(rawTarget);
  if (shouldIgnore(target)) return;

  const pathOnly = target.split('#', 1)[0].split('?', 1)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    failures.push(`${relative(root, file)}:${lineNumber(source, index)} invalid URI: ${target}`);
    return;
  }

  const resolved = resolve(dirname(file), decoded);
  const relativeToRoot = relative(root, resolved);
  if (relativeToRoot.startsWith(`..${sep}`) || relativeToRoot === '..') {
    failures.push(`${relative(root, file)}:${lineNumber(source, index)} escapes repository: ${target}`);
    return;
  }

  if (!existsSync(resolved)) {
    failures.push(`${relative(root, file)}:${lineNumber(source, index)} missing target: ${target}`);
    return;
  }

  if (target.endsWith('/') && !statSync(resolved).isDirectory()) {
    failures.push(`${relative(root, file)}:${lineNumber(source, index)} expected directory: ${target}`);
  }
}

walk(root);
const failures = [];

for (const file of markdownFiles) {
  const source = readFileSync(file, 'utf8');
  const searchable = source
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]+`/g, '');

  const inlineLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
  const referenceLink = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

  for (const match of searchable.matchAll(inlineLink)) {
    validateTarget(file, searchable, match.index ?? 0, match[1], failures);
  }
  for (const match of searchable.matchAll(referenceLink)) {
    validateTarget(file, searchable, match.index ?? 0, match[1], failures);
  }
}

if (failures.length > 0) {
  console.error(`Documentation link check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Documentation link check passed for ${markdownFiles.length} maintained Markdown file(s).`);
