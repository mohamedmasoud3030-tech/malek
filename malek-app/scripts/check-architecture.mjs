import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

const cwd = process.cwd();
const sourceRoot = resolve('src');
const sourceFiles = collectSourceFiles(sourceRoot);
const sourceSet = new Set(sourceFiles);
const violations = [];

const featureDependencyAllowList = new Map([
  ['admin-support', new Set(['auth'])],
  ['ai-assistant', new Set(['financials', 'maintenance'])],
  ['automation', new Set(['communication'])],
  ['audit', new Set(['auth', 'settings'])],
  ['commissions', new Set(['contracts', 'financials', 'lands', 'leads', 'people', 'properties'])],
  ['command-palette', new Set(['auth'])],
  ['contracts', new Set(['financials', 'owners', 'people', 'properties', 'settings', 'units'])],
  ['dashboard', new Set(['contracts', 'financials', 'maintenance', 'onboarding', 'properties', 'units', 'utilities'])],
  ['finance', new Set(['auth', 'financials'])],
  ['financials', new Set(['auth', 'contracts', 'owners', 'properties', 'settings', 'accounting'])],
  ['maintenance', new Set(['financials', 'properties', 'reports', 'service-providers', 'settings', 'units'])],
  ['onboarding', new Set(['owners'])],
  ['owners', new Set(['auth', 'financials', 'properties', 'reports', 'settings', 'units'])],
  ['people', new Set(['contracts', 'financials', 'tenants'])],
  ['properties', new Set(['contracts', 'financials', 'owners', 'settings', 'units'])],
  ['reports', new Set(['accounting', 'auth', 'contracts', 'financials', 'maintenance', 'owners', 'properties', 'settings', 'units', 'utilities'])],
  // settings owns users & permissions after the navigation consolidation, so it
  // consumes the auth permission seam (AppPermission / permission-request-service).
  ['settings', new Set(['auth', 'properties', 'financials', 'units'])],
  ['system', new Set(['auth', 'settings', 'financials'])],
  ['tenants', new Set(['contracts', 'financials', 'people'])],
  ['units', new Set(['contracts', 'properties'])],
  ['utilities', new Set(['financials', 'properties', 'reports', 'settings'])],
]);

const presentationServiceDebtAllowList = new Set([]);
const presentationDataPlaneDebtAllowList = new Set([]);
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
  if (isComponentsDirectoryModule(file) && imports.some((specifier) => specifier === '@/lib/supabase')) {
    violations.push(`${displayPath}: presentation components must not import Supabase directly`);
  }
  if (isPresentationComponent(file) && hasDirectSupabaseDataPlaneAccess(content) && !presentationDataPlaneDebtAllowList.has(relative(sourceRoot, file).split(sep).join('/'))) {
    violations.push(`${displayPath}: presentation components must not call supabase.from()/supabase.rpc() directly; move data access to a feature service or hook`);
  }
  if (isComponentsDirectoryModule(file) && runtimeImports.some((specifier) => isCrossFeatureServiceImport(file, specifier)) && !presentationServiceDebtAllowList.has(relative(sourceRoot, file).split(sep).join('/'))) {
    violations.push(`${displayPath}: presentation components must use a feature hook instead of importing a cross-feature service`);
  }
  if (isFeatureFile(file)) {
    for (const specifier of imports) {
      const dependencyViolation = getFeatureDependencyViolation(file, specifier);
      if (dependencyViolation) violations.push(`${displayPath}: ${dependencyViolation}`);
    }
  }
  if (isPage(file) && lineCount(content) > 650) {
    violations.push(`${displayPath}: pages must stay below 650 lines; split new responsibilities before extending this page`);
  }
  graph.set(file, resolveImports(file, imports));
}

validateDebtAllowLists();
validateFeatureDependencyAllowListFeatures();
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
function isComponentsDirectoryModule(file) {
  return relative(sourceRoot, file).split(sep).includes('components');
}
function isPresentationComponent(file) {
  if (isComponentsDirectoryModule(file)) return true;
  if (!file.endsWith('.tsx')) return false;
  const parts = relative(sourceRoot, file).split(sep);
  if (parts.some((part) => part === 'hooks' || part === 'services')) return false;
  const fileName = parts[parts.length - 1];
  if (/^use[-A-Z]/.test(fileName)) return false;
  if (/(?:[-.]service|Service)\.tsx$/.test(fileName)) return false;
  if (/\.e2e-fixture\.tsx$/.test(fileName)) return false;
  return true;
}
function hasDirectSupabaseDataPlaneAccess(content) {
  return /\bsupabase\s*(?:\n\s*)?\.\s*(?:from|rpc)\s*\(/.test(content);
}
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
  return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((suffix) => `${absoluteBase}${suffix}`).filter((candidate) => sourceSet.has(candidate));
}
function isFeatureFile(file) { return getFeatureNameFromPath(file) !== null; }
function isCrossFeatureServiceImport(file, specifier) {
  const sourceFeature = getFeatureNameFromPath(file);
  const targetFeature = getFeatureNameFromSpecifier(file, specifier);
  if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) return false;
  return /(?:^|\/)services?\//.test(specifier) || /(?:[-.]service|Service)(?:\.[cm]?[jt]sx?)?$/.test(specifier);
}
function validateDebtAllowLists() {
  for (const normalizedPath of presentationDataPlaneDebtAllowList) {
    const file = resolve(sourceRoot, normalizedPath);
    if (!sourceSet.has(file)) {
      violations.push(`${normalizedPath}: stale presentation data-plane debt allowlist entry; file no longer exists`);
      continue;
    }
    const content = readFileSync(file, 'utf8');
    if (!isPresentationComponent(file) || !hasDirectSupabaseDataPlaneAccess(content)) violations.push(`${normalizedPath}: stale presentation data-plane debt allowlist entry; direct supabase.from()/supabase.rpc() access is gone`);
  }
  for (const normalizedPath of presentationServiceDebtAllowList) {
    const file = resolve(sourceRoot, normalizedPath);
    if (!sourceSet.has(file)) {
      violations.push(`${normalizedPath}: stale presentation service debt allowlist entry; file no longer exists`);
      continue;
    }
    const content = readFileSync(file, 'utf8');
    const runtimeImports = getRuntimeImportSpecifiers(content);
    if (!isComponentsDirectoryModule(file) || !runtimeImports.some((specifier) => isCrossFeatureServiceImport(file, specifier))) violations.push(`${normalizedPath}: stale presentation service debt allowlist entry; cross-feature runtime service import is gone`);
  }
}
function validateFeatureDependencyAllowListFeatures() {
  const featureNames = new Set(sourceFiles.map((file) => getFeatureNameFromPath(file)).filter(Boolean));
  for (const [sourceFeature, targetFeatures] of featureDependencyAllowList) {
    if (!featureNames.has(sourceFeature)) violations.push(`features/${sourceFeature}: stale feature dependency allowlist key; source feature no longer exists`);
    for (const targetFeature of targetFeatures) if (!featureNames.has(targetFeature)) violations.push(`features/${sourceFeature}: stale feature dependency target ${targetFeature}; target feature no longer exists`);
  }
}
function getFeatureDependencyViolation(file, specifier) {
  const sourceFeature = getFeatureNameFromPath(file);
  const targetFeature = getFeatureNameFromSpecifier(file, specifier);
  if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) return null;
  const allowedTargets = featureDependencyAllowList.get(sourceFeature) ?? new Set();
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
