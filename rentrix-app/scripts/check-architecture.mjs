import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const sourceRoot = resolve('src');
const sourceFiles = collectSourceFiles(sourceRoot);
const sourceSet = new Set(sourceFiles);
const violations = [];
const focusedFeatureAllowList = new Map([
  ['properties', new Set(['owners', 'units', 'financials'])],
  ['units', new Set(['properties'])],
]);

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  const displayPath = relative(process.cwd(), file);
  const imports = [...content.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)].map((match) => match[1]);

  if (isPresentationComponent(file) && imports.some((specifier) => specifier === '@/lib/supabase')) {
    violations.push(`${displayPath}: presentation components must not import Supabase directly`);
  }

  if (isPresentationComponent(file) && imports.some((specifier) => specifier.startsWith('@/services/') || (isFocusedPropertyArchitectureFile(file) && /(?:^|\/)services\//.test(specifier)))) {
    violations.push(`${displayPath}: presentation components must use a hook instead of importing a service`);
  }

  if (isFocusedPropertyArchitectureFile(file)) {
    for (const specifier of imports) {
      const dependencyViolation = getFocusedPropertyDependencyViolation(file, specifier);
      if (dependencyViolation) violations.push(`${displayPath}: ${dependencyViolation}`);
    }
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


function isFocusedPropertyArchitectureFile(file) {
  const normalized = relative(process.cwd(), file).split(sep).join('/');
  return normalized.startsWith('src/features/properties/') || normalized.startsWith('src/features/units/');
}

function getFocusedPropertyDependencyViolation(file, specifier) {
  const sourceFeature = getFeatureNameFromPath(file);
  const targetFeature = getFeatureNameFromSpecifier(specifier);
  if (!sourceFeature || !targetFeature || sourceFeature === targetFeature) return null;
  const allowedTargets = focusedFeatureAllowList.get(sourceFeature) ?? new Set();
  if (allowedTargets.has(targetFeature)) return null;
  return `unexpected cross-feature import from ${sourceFeature} to ${targetFeature}; move shared-neutral code to a real shared module or add a narrow allow-list entry`;
}

function getFeatureNameFromPath(file) {
  const parts = relative(sourceRoot, file).split(sep);
  return parts[0] === 'features' ? parts[1] : null;
}

function getFeatureNameFromSpecifier(specifier) {
  const aliasMatch = specifier.match(/^@\/features\/([^/]+)/);
  if (aliasMatch) return aliasMatch[1];
  if (!specifier.startsWith('.')) return null;
  return null;
}
