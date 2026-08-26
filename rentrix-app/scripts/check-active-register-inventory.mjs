import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractInventoryComponents(content) {
  return [...content.matchAll(/\bcomponent:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
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

export function validateActiveRegisterInventory({
  inventoryFile = resolve('src/features/active-register-inventory.ts'),
  sourceRoot = resolve('src'),
  fileExists = existsSync,
} = {}) {
  const content = readFileSync(inventoryFile, 'utf8');
  const components = extractInventoryComponents(content);
  return findInventoryProblems(components, { sourceRoot, fileExists });
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
