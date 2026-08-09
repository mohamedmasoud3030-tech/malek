import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'rentrix-app/src');

// Same allowlist as the guard
const allowedPrefixes = [
  `rentrix-app/src/components/enterprise/`,
  `rentrix-app/src/features/design-system/`,
];

function isAllowedFile(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (allowedPrefixes.some((p) => rel.startsWith(p))) return true;
  if (/\.test\.(ts|tsx)$/.test(rel)) return true;
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) return true;
  return false;
}

function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = resolve(dir, e.name);
    if (e.isDirectory()) return collectFiles(full);
    if (/\.(ts|tsx)$/.test(e.name)) return [full];
    return [];
  });
}

const pattern = /from\s+['"](@\/components\/enterprise[^'"]*|@\/components\/enterprise|.*\/enterprise\/[^'"]*|.*enterprise\/[^'"]*)['"]/g;

let violations = [];
for (const file of collectFiles(SRC)) {
  if (isAllowedFile(file)) continue;
  const content = readFileSync(file, 'utf8');
  const matches = [...content.matchAll(pattern)];
  if (matches.length > 0) violations.push(relative(ROOT, file));
}

assert.equal(
  violations.length,
  0,
  `Enterprise freeze guard test: new enterprise/* imports found in prod files: ${violations.join(', ')}`
);

console.log('check-no-new-enterprise-usage.test.mjs: PASS');
