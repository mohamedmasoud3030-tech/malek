#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const excludedDirectoryNames = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vercel']);
const excludedRepositoryPaths = new Set(['.agents/skills']);

function toRepositoryPath(absolutePath) {
  return relative(root, absolutePath).split(sep).join('/');
}

function shouldSkipDirectory(name, absolutePath) {
  return (
    excludedDirectoryNames.has(name) ||
    excludedRepositoryPaths.has(toRepositoryPath(absolutePath))
  );
}

function collectMarkdownFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name, absolutePath)) collectMarkdownFiles(absolutePath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolutePath);
  }
  return files;
}

function stripInlineCode(line) {
  let insideCode = false;
  let result = '';
  for (const character of line) {
    if (character === '`') {
      insideCode = !insideCode;
      continue;
    }
    if (!insideCode) result += character;
  }
  return result;
}

function extractInlineTargets(line) {
  const targets = [];
  let cursor = 0;
  while (cursor < line.length) {
    const marker = line.indexOf('](', cursor);
    if (marker === -1) break;
    const targetStart = marker + 2;
    const targetEnd = line.indexOf(')', targetStart);
    if (targetEnd === -1) break;
    targets.push(line.slice(targetStart, targetEnd));
    cursor = targetEnd + 1;
  }
  return targets;
}

function extractReferenceTarget(line) {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith('[')) return null;
  const marker = trimmed.indexOf(']:');
  if (marker <= 1) return null;
  return trimmed.slice(marker + 2).trim();
}

function firstWhitespaceIndex(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === ' ' || value[index] === '\t') return index;
  }
  return -1;
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (target.startsWith('<') && target.endsWith('>')) return target.slice(1, -1).trim();
  const whitespace = firstWhitespaceIndex(target);
  if (whitespace !== -1) target = target.slice(0, whitespace);
  return target;
}

function shouldIgnore(target) {
  if (target === '' || target.startsWith('#') || target.startsWith('/')) return true;
  if (target.includes('{{') || target.includes('${')) return true;
  const lowerTarget = target.toLowerCase();
  return ['http:', 'https:', 'mailto:', 'tel:', 'data:', 'javascript:'].some((prefix) =>
    lowerTarget.startsWith(prefix),
  );
}

function removeQueryAndFragment(target) {
  const fragment = target.indexOf('#');
  const query = target.indexOf('?');
  const indexes = [fragment, query].filter((index) => index !== -1);
  return indexes.length === 0 ? target : target.slice(0, Math.min(...indexes));
}

function decodeTarget(target, context, failures) {
  try {
    return decodeURIComponent(removeQueryAndFragment(target));
  } catch {
    failures.push(`${context} invalid URI: ${target}`);
    return null;
  }
}

function validateTarget(file, lineNumber, rawTarget, failures) {
  const target = normalizeTarget(rawTarget);
  if (shouldIgnore(target)) return;

  const context = `${toRepositoryPath(file)}:${lineNumber}`;
  const decoded = decodeTarget(target, context, failures);
  if (decoded === null) return;

  const resolved = resolve(dirname(file), decoded);
  const relativeToRoot = relative(root, resolved);
  if (relativeToRoot === '..' || relativeToRoot.startsWith(`..${sep}`)) {
    failures.push(`${context} escapes repository: ${target}`);
    return;
  }
  if (!existsSync(resolved)) {
    failures.push(`${context} missing target: ${target}`);
    return;
  }
  if (target.endsWith('/') && !statSync(resolved).isDirectory()) {
    failures.push(`${context} expected directory: ${target}`);
  }
}

function validateMarkdownFile(file, failures) {
  const lines = readFileSync(file, 'utf8').replaceAll('\r\n', '\n').split('\n');
  let fence = null;

  lines.forEach((line, index) => {
    const trimmed = line.trimStart();
    if (fence !== null) {
      if (trimmed.startsWith(fence)) fence = null;
      return;
    }
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fence = trimmed.slice(0, 3);
      return;
    }

    const searchable = stripInlineCode(line);
    const targets = extractInlineTargets(searchable);
    const referenceTarget = extractReferenceTarget(searchable);
    if (referenceTarget !== null) targets.push(referenceTarget);
    targets.forEach((target) => validateTarget(file, index + 1, target, failures));
  });
}

const markdownFiles = collectMarkdownFiles(root);
const failures = [];
markdownFiles.forEach((file) => validateMarkdownFile(file, failures));

if (failures.length > 0) {
  console.error(`Documentation link check failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Documentation link check passed for ${markdownFiles.length} maintained Markdown file(s).`);
}
