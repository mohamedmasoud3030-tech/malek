import assert from 'node:assert/strict';
import test from 'node:test';
import { extractInventoryComponents, findInventoryProblems } from './check-active-register-inventory.mjs';

test('extracts every declared active register component path', () => {
  assert.deepEqual(
    extractInventoryComponents(`[
      { component: 'features/a/a.tsx', routes: ['/a'] },
      { component: "features/b/b.tsx", routes: ['/b'] },
    ]`),
    ['features/a/a.tsx', 'features/b/b.tsx'],
  );
});

test('fails closed when the inventory parser sees no component entries', () => {
  assert.deepEqual(findInventoryProblems([]), [
    'active register inventory parser found zero component entries',
  ]);
});

test('reports stale and duplicate inventory paths', () => {
  const existing = new Set(['/src/features/a/a.tsx']);
  const problems = findInventoryProblems(
    ['features/a/a.tsx', 'features/missing/missing.tsx', 'features/a/a.tsx'],
    {
      sourceRoot: '/src',
      fileExists: (path) => existing.has(path),
    },
  );

  assert.deepEqual(problems, [
    'features/missing/missing.tsx: stale active register inventory path; component file does not exist',
    'features/a/a.tsx: duplicate active register inventory entry',
  ]);
});
