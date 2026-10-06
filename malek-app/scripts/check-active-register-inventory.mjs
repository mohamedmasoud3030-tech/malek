import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractInventoryComponents(content) {
  return [...content.matchAll(/\bcomponent:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

/**
 * Registers promoted to standalone canonical routes by the navigation
 * architecture consolidation. Recording one of them behind a legacy hub query
 * URL (?section= / ?view= / ?workspace=) would silently re-adopt the retired hub
 * as its canonical destination, so that drift is rejected here.
 */
const PROMOTED_STANDALONE_SECTION_KEYS = new Set([
  'utilities',
  'documents_vault',
  'service_providers',
  'automation',
  'audit-log',
  'data-integrity',
  'users-permissions',
  'cost-centers',
  'system-settings',
  'security',
  'people',
  'tenants',
  'leads',
  'communication',
]);

function extractInventoryRoutes(content) {
  const routes = [];
  for (const match of content.matchAll(/\broutes:\s*\[([^\]]*)\]/g)) {
    for (const literal of match[1].matchAll(/['"]([^'"]+)['"]/g)) routes.push(literal[1]);
  }
  return routes;
}

function findInventoryRouteProblems(routes) {
  const problems = [];
  if (routes.length === 0) {
    problems.push('active register inventory parser found zero route entries');
    return problems;
  }
  for (const route of routes) {
    const [path, query = ''] = route.split('?');
    if (!path.startsWith('/')) {
      problems.push(`${route}: inventory route must be an absolute canonical path`);
    }
    for (const param of query.split('&')) {
      const [key, value] = param.split('=');
      if (!['section', 'view', 'workspace'].includes(key)) continue;
      if (PROMOTED_STANDALONE_SECTION_KEYS.has(value)) {
        problems.push(
          `${route}: legacy hub query URL recorded as canonical; ` +
          `'${key}=${value}' owns a standalone canonical route after the navigation consolidation`,
        );
      }
    }
  }
  return problems;
}

export function findInventoryProblems(components, { sourceRoot = resolve('src'), fileExists = existsSync } = {}) {
  const problems = [];
  const seen = new Set();

  if (components.length === 0) {
    problems.push('active register inventory parser found zero component entries');
    return problems;
  }

  for (const component of components) {
    if (seen.has(component)) {
      problems.push(`${component}: duplicate active register inventory entry`);
      continue;
    }
    seen.add(component);

    if (!fileExists(resolve(sourceRoot, component))) {
      problems.push(`${component}: stale active register inventory path; component file does not exist`);
    }
  }

  return problems;
}

function validateActiveRegisterInventory({
  inventoryFile = resolve('src/features/active-register-inventory.ts'),
  sourceRoot = resolve('src'),
  fileExists = existsSync,
} = {}) {
  const content = readFileSync(inventoryFile, 'utf8');
  const components = extractInventoryComponents(content);
  return [
    ...findInventoryProblems(components, { sourceRoot, fileExists }),
    ...findInventoryRouteProblems(extractInventoryRoutes(content)),
  ];
}

function run() {
  const problems = validateActiveRegisterInventory();
  if (problems.length > 0) {
    console.error('Active register inventory check failed:\n' + problems.map((problem) => `- ${problem}`).join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('Active register inventory check passed.');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) run();
