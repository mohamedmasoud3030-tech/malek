#!/usr/bin/env node
/**
 * Enterprise freeze guard — Phase 1 Foundation.
 *
 * Rule: no new imports of `enterprise/*` outside:
 *   - rentrix-app/src/components/enterprise/** (the system itself)
 *   - rentrix-app/src/features/design-system/** (showcase)
 *   - rentrix-app/src/components/enterprise/*.test.* + *.test.*
 *
 * Production features must compose from components/ui + components/layout only.
 * This guard is informational in Phase 1 (blocks CI only for new violations
 * beyond the frozen baseline). To enforce strictly, run with --strict.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'rentrix-app/src');
const strict = process.argv.includes('--strict');

// Allowlist: files that MAY import enterprise/* (now enterprise is completely deleted, only design-system allowed)
const allowedPrefixes = [
  `rentrix-app/src/features/design-system/`,
];

function isAllowedFile(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (allowedPrefixes.some((p) => rel.startsWith(p))) return true;
  // tests are allowed to import enterprise/* to verify it
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
const violations = [];

for (const file of collectFiles(SRC)) {
  if (isAllowedFile(file)) continue;
  const content = readFileSync(file, 'utf8');
  const matches = [...content.matchAll(pattern)];
  if (matches.length === 0) continue;
  // filter out false positives on comments? keep simple.
  // Also catch bare `import 'enterprise/*'` without from
  violations.push({ file: relative(ROOT, file).split(sep).join('/'), matches: matches.map((m) => m[1]) });
}

// Also catch dynamic enterprise-header imports in comments? ignore.

if (violations.length > 0) {
  console.error('Enterprise freeze guard — violations found:');
  for (const v of violations) {
    console.error(`- ${v.file}: ${v.matches.join(', ')}`);
  }
  console.error('\nPolicy: no new imports of enterprise/* outside components/enterprise and features/design-system.');
  console.error('If intentional, add the new consumer to allowedPrefixes in scripts/check-no-new-enterprise-usage.mjs with justification.');
  // In non-strict mode we still fail if any prod file imports enterprise — Phase 1 foundation requires zero prod usage.
  // The previous audit found zero prod usage, so any violation is a new regression.
  process.exitCode = 1;
} else {
  console.log('Enterprise freeze guard: PASS — no new enterprise/* imports outside allowlist.');
}
