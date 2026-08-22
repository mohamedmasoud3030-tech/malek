#!/usr/bin/env node
// Regression: Guardian must not false-green when PGlite.close() force-exits 0.
//
// PGlite.close() calls Emscripten `_emscripten_force_exit(0)`, which terminates
// the Node process with status 0 even after `process.exitCode = 1`.
// Strict governance therefore uses process.exit(status) and must not close
// the disposable database first.
//
// Usage: node scripts/guardian/governance-exit.test.mjs

import { spawnSync } from 'node:child_process';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function runModule(source) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 30_000,
  });
}

test('assigning process.exitCode then closing PGlite exits 0 (documented hazard)', () => {
  const result = runModule(`
    import { PGlite } from '@electric-sql/pglite';
    const db = await PGlite.create();
    process.exitCode = 1;
    await db.close();
  `);
  if (result.status !== 0) {
    throw new Error(`expected swallowed status 0, got ${result.status}\n${result.stderr}`);
  }
});

test('process.exit(1) before PGlite.close reports blocking failure', () => {
  const result = runModule(`
    import { PGlite } from '@electric-sql/pglite';
    const db = await PGlite.create();
    process.exit(1);
    await db.close();
  `);
  if (result.status !== 1) {
    throw new Error(`expected exit 1, got ${result.status}\n${result.stderr}`);
  }
});

test('process.exit(0) reports a clean Guardian run', () => {
  const result = runModule(`
    import { PGlite } from '@electric-sql/pglite';
    const db = await PGlite.create();
    process.exit(0);
    await db.close();
  `);
  if (result.status !== 0) {
    throw new Error(`expected exit 0, got ${result.status}\n${result.stderr}`);
  }
});

console.log('');
console.log(`Guardian exit regressions: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
