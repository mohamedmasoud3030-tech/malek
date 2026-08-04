import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

const cwd = process.cwd();
const sourceRoot = resolve('src');
const sourceFiles = collectSourceFiles(sourceRoot);
const sourceSet = new Set(sourceFiles);
const violations = [];

// Every existing cross-feature edge is explicit. A new feature starts with no
// cross-feature access until its integration seam is reviewed and added here.
const featureDependencyAllowList = new Map([
  ['ai-assistant', new Set(['financials'])],
  ['audit', new Set(['auth', 'settings'])],
  ['contracts', new Set(['financials', 'owners', 'people', 'properties', 'settings', 'units'])],
  ['dashboard', new Set(['contracts', 'financials', 'maintenance', 'onboarding'])],
  // finance-hub is the composition layer for the finance workspaces: it owns
  // the shared page shell, tabs, URL sync, and per-tab permission checks, then
  // lazily renders the section bodies that still live in their own features.
  ['finance-hub', new Set(['auth', 'commissions', 'financials', 'owners'])],
  ['financials', new Set(['auth', 'contracts', 'properties', 'reports', 'settings'])],
  // governance-hub composes settings/system/audit/auth workspaces under /settings.
  ['governance-hub', new Set(['auth', 'audit', 'settings', 'system'])],
  // maintenance reads the shared document-print readiness seam
  // (useDocumentSettings) so the A4 statement only prints with real company
  // identity — same reviewed seam already granted to financials/owners/reports.
  ['maintenance', new Set(['financials', 'properties', 'reports', 'settings', 'units'])],
  ['onboarding', new Set(['owners'])],
  // operations-hub composes maintenance/utilities/automation/documents-vault.
  ['operations-hub', new Set(['auth', 'automation', 'documents-vault', 'maintenance', 'utilities'])],
  ['owners', new Set(['auth', 'financials', 'properties', 'reports', 'settings'])],
  ['people', new Set(['tenants'])],
  // portfolio-hub composes properties/owners/units/lands under /properties.
  ['portfolio-hub', new Set(['auth', 'lands', 'owners', 'properties', 'units'])],
  ['properties', new Set(['financials', 'owners', 'units'])],
  // relationships-hub composes contracts/people/tenants/leads/communication.
  ['relationships-hub', new Set(['auth', 'communication', 'contracts', 'leads', 'people', 'tenants'])],
  ['reports', new Set(['auth', 'contracts', 'financials', 'maintenance', 'owners', 'properties', 'settings', 'units'])],
  ['settings', new Set(['properties'])],
  ['system', new Set(['auth', 'settings'])],
  ['tenants', new Set(['financials', 'people'])],
  ['units', new Set(['properties'])],
  // utilities reads the shared document-print readiness seam
  // (useDocumentSettings) so the utilities statement only prints with real
  // company identity — same reviewed seam already granted to financials.
  ['utilities', new Set(['financials', 'properties', 'reports', 'settings'])],
]);

// These are known presentation-to-service debts, frozen so the guard blocks
// new exceptions while they are migrated to feature hooks in bounded PRs.
const presentationServiceDebtAllowList = new Set([
  'features/owners/components/owner-detail-view.tsx',
  'features/reports/components/CollectionsSection.tsx',
  'features/reports/components/ExpensesSection.tsx',
  'features/reports/components/FiltersPanel.tsx',
  'features/reports/components/MaintenanceReportSection.tsx',
  'features/reports/components/OverdueSection.tsx',
  'features/reports/components/ReportsFilterSurface.tsx',
  'features/reports/components/StatementsSection.tsx',
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

  if (
    isPresentationComponent(file)
    && runtimeImports.some((specifier) => isCrossFeatureServiceImport(file, specifier))
    && !presentationServiceDebtAllowList.has(relative(sourceRoot, file).split(sep).join('/'))
  ) {
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

function isFeatureFile(file) {
  return getFeatureNameFromPath(file) !== null;
}

function isCrossFeatureServiceImport(file, specifier) {
  const sourceFeature = getFeatureNameFromPath(file);
  const targetFeature = getFeatureNameFromSpecifier(file, specifier);
  if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) return false;
  return /(?:^|\/)services?\//.test(specifier) || /Service(?:\.[cm]?[jt]sx?)?$/.test(specifier);
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
