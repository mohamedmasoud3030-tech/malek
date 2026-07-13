import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

const cwd = process.cwd();
const sourceRoot = resolve('src');
const sourceFiles = collectSourceFiles(sourceRoot);
const sourceSet = new Set(sourceFiles);
const violations = [];

const focusedFeatureAllowList = new Map([
  // Properties may render unit/owner/financial summaries through explicit integration seams only.
  ['properties', new Set(['owners', 'units', 'financials'])],
  // Units may reference property labels/services; properties must not imply a reciprocal free-for-all.
  ['units', new Set(['properties'])],
  // Contract UI needs property/unit/owner option hooks and tenant/person selection while contract services remain the owner of mutations.
  ['contracts', new Set(['properties', 'units', 'owners', 'people', 'settings', 'financials'])],
]);

const allowedAppDirectories = new Set(['layout', 'navigation', 'providers', 'router']);
const allowedAppFiles = new Set(['not-found-page.tsx']);

const graph = new Map();

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  const displayPath = relative(cwd, file);
  const imports = getImportSpecifiers(content);
  const runtimeImports = getRuntimeImportSpecifiers(content);

  const appBoundaryViolation = getAppBoundaryViolation(file);
  if (appBoundaryViolation) violations.push(`${displayPath}: ${appBoundaryViolation}`);

  if (isPresentationComponent(file) && imports.some((specifier) => specifier === '@/lib/supabase')) {
    violations.push(`${displayPath}: presentation components must not import Supabase directly`);
  }

  if (isPresentationComponent(file) && isFocusedArchitectureFile(file) && runtimeImports.some((specifier) => specifier.startsWith('@/services/') || /(?:^|\/)services\//.test(specifier))) {
    violations.push(`${displayPath}: presentation components must use a hook instead of importing a service`);
  }

  if (isFocusedArchitectureFile(file)) {
    for (const specifier of imports) {
      const dependencyViolation = getFocusedDependencyViolation(file, specifier);
      if (dependencyViolation) violations.push(`${displayPath}: ${dependencyViolation}`);
    }
  }

  if (isPage(file) && lineCount(content) > 650) {
    violations.push(`${displayPath}: pages must stay below 650 lines; split new responsibilities before extending this page`);
  }

  graph.set(file, resolveImports(file, imports));
}

for (const cycle of findCycles(graph)) {
  violations.push(`${cycle.map((file) => relative(cwd, file)).join(' -> ')}: circular import`);
}

if (violations.length > 0) {
  console.error('Architecture boundary check failed:\n' + violations.map((violation) => `- ${violation}`).join('\n'));
  process.exitCode = 1;
}

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function getImportSpecifiers(content) {
  return [...content.matchAll(/import(?:\s+type)?[\s\S]*?from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
    .concat([...content.matchAll(/import\s+['"]([^'"]+)['"]/g)].map((match) => match[1]));
}

function getRuntimeImportSpecifiers(content) {
  return [...content.matchAll(/import(?!\s+type)[\s\S]*?from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
    .concat([...content.matchAll(/import\s+['"]([^'"]+)['"]/g)].map((match) => match[1]));
}

function isPresentationComponent(file) { return file.split(sep).includes('components'); }
function isPage(file) { return /(?:page|Page)\.tsx$/.test(file); }
function lineCount(content) { return content.split('\n').length; }

function getAppBoundaryViolation(file) {
  const normalized = relative(sourceRoot, file).split(sep).join('/');
  const match = normalized.match(/^app\/([^/]+)(?:\/|$)/);
  if (!match) return null;
  const entry = match[1];
  if (allowedAppDirectories.has(entry) || allowedAppFiles.has(entry)) return null;
  return 'app/ is reserved for composition infrastructure; move business pages, services, snapshots, and domain logic to features/<domain>';
}

function resolveImports(file, specifiers = getImportSpecifiers(readFileSync(file, 'utf8'))) {
  return specifiers.flatMap((specifier) => resolveImport(file, specifier));
}

function resolveImport(file, specifier) {
  let absoluteBase = null;
  if (specifier.startsWith('@/')) absoluteBase = resolve(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) absoluteBase = resolve(dirname(file), specifier);
  if (!absoluteBase) return [];
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
    .map((suffix) => `${absoluteBase}${suffix}`)
    .filter((candidate) => sourceSet.has(candidate));
}

function isFocusedArchitectureFile(file) {
  const normalized = relative(sourceRoot, file).split(sep).join('/');
  const feature = normalized.match(/^features\/([^/]+)\//)?.[1];
  return Boolean(feature && focusedFeatureAllowList.has(feature));
}

function getFocusedDependencyViolation(file, specifier) {
  const sourceFeature = getFeatureNameFromPath(file);
  const targetFeature = getFeatureNameFromSpecifier(file, specifier);
  if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) return null;
  const allowedTargets = focusedFeatureAllowList.get(sourceFeature) ?? new Set();
  if (allowedTargets.has(targetFeature)) return null;
  return `unexpected cross-feature import from ${sourceFeature} to ${targetFeature}; use a feature hook/service seam or move shared-neutral code to a real shared module`;
}

function getFeatureNameFromPath(file) {
  const parts = relative(sourceRoot, file).split(sep);
  return parts[0] === 'features' ? parts[1] : null;
}

function getFeatureNameFromSpecifier(file, specifier) {
  if (specifier.startsWith('@/features/')) return specifier.split('/')[2] ?? null;
  if (!specifier.startsWith('.')) return null;
  const resolved = resolve(dirname(file), specifier);
  const relativeToSource = relative(sourceRoot, resolved).split(sep);
  return relativeToSource[0] === 'features' ? relativeToSource[1] : null;
}

function findCycles(graph) {
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const seen = new Set();

  function visit(node) {
    if (visiting.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      const key = [...new Set(cycle)].sort((left, right) => left.localeCompare(right)).join('|');
      if (!seen.has(key)) { seen.add(key); cycles.push(cycle); }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) visit(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) visit(node);
  return cycles;
}
