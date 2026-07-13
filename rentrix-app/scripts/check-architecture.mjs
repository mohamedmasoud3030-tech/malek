import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const sourceRoot = resolve('src');
const sourceFiles = collectSourceFiles(sourceRoot);
const sourceSet = new Set(sourceFiles);
const violations = [];

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  const displayPath = relative(process.cwd(), file);
  const imports = [...content.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)].map((match) => match[1]);

  if (isPresentationComponent(file) && imports.some((specifier) => specifier === '@/lib/supabase')) {
    violations.push(`${displayPath}: presentation components must not import Supabase directly`);
  }

  if (isPresentationComponent(file) && imports.some((specifier) => specifier.startsWith('@/services/'))) {
    violations.push(`${displayPath}: presentation components must use a hook instead of importing a service`);
  }

  if (isPage(file) && lineCount(content) > 650) {
    violations.push(`${displayPath}: pages must stay below 650 lines; split new responsibilities before extending this page`);
  }
}

for (const file of sourceFiles) {
  for (const target of resolveImports(file)) {
    if (target <= file || !sourceSet.has(target)) continue;
    if (resolveImports(target).includes(file)) {
      violations.push(`${relative(process.cwd(), file)} <-> ${relative(process.cwd(), target)}: circular import`);
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary check failed:\n' + violations.map((violation) => `- ${violation}`).join('\n'));
  process.exitCode = 1;
}

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function isPresentationComponent(file) {
  return file.split(sep).includes('components');
}

function isPage(file) {
  return /(?:page|Page)\.tsx$/.test(file);
}

function lineCount(content) {
  return content.split('\n').length;
}

function resolveImports(file) {
  const content = readFileSync(file, 'utf8');
  const specifiers = [...content.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)].map((match) => match[1]);
  return specifiers.flatMap((specifier) => resolveImport(file, specifier));
}

function resolveImport(file, specifier) {
  const absoluteBase = specifier.startsWith('@/')
    ? resolve(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(file, '..', specifier)
      : null;
  if (!absoluteBase) return [];

  return ['.ts', '.tsx', '/index.ts', '/index.tsx']
    .map((suffix) => `${absoluteBase}${suffix}`)
    .filter((candidate) => sourceSet.has(candidate));
}
