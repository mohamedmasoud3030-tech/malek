/**
 * Self-test for the workflow honesty guard.
 *
 * It must (a) pass on the repository's real workflows and (b) actually reject
 * the two shapes that caused the original defect, so the guard can never become
 * a green no-op itself.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const repoRoot = resolve(import.meta.dirname, '..');
const guard = join(repoRoot, 'scripts', 'check-workflow-honesty.mjs');

function runGuard(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [guard, '--root', cwd], { cwd, encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status ?? 1, stdout: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** Builds a throwaway repo skeleton with a given set of workflow bodies. */
function withFixture(workflows, callback) {
  const dir = mkdtempSync(join(tmpdir(), 'workflow-honesty-'));
  try {
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
    for (const [name, body] of Object.entries(workflows)) {
      writeFileSync(join(dir, '.github', 'workflows', name), body, 'utf8');
    }
    callback(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// 1. The repository's real workflows must satisfy the guard.
const real = runGuard(repoRoot);
assert.equal(real.code, 0, `the repository's own workflows must pass the honesty guard:\n${real.stdout}`);

// 2. An echo-only job must be rejected.
withFixture({
  'fake.yml': [
    'name: Fake',
    'on:',
    '  pull_request:',
    'jobs:',
    '  release-gate:',
    '    name: Release Gate',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Manual release validation',
    '        run: echo "Full release validation is manual during active development."',
    '',
  ].join('\n'),
}, (dir) => {
  const result = runGuard(dir);
  assert.equal(result.code, 1, 'an echo-only job must fail the guard');
  assert.match(result.stdout, /release-gate/, 'the violation must name the offending job');
});

// 3. A deferral that admits it is inert must be rejected even beside real work.
withFixture({
  'deferred.yml': [
    'name: Deferred',
    'on:',
    '  pull_request:',
    'jobs:',
    '  real:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Real work',
    '        run: pnpm test',
    '  browser:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Defer expensive browser matrix',
    '        run: echo "Browsers are deferred on ordinary PRs."',
    '',
  ].join('\n'),
}, (dir) => {
  const result = runGuard(dir);
  assert.equal(result.code, 1, 'a green deferral placeholder must fail the guard');
  assert.match(result.stdout, /browser/, 'the violation must name the offending job');
});

// 4. A workflow where every job does real work must pass.
withFixture({
  'honest.yml': [
    'name: Honest',
    'on:',
    '  pull_request:',
    'jobs:',
    '  verify:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Typecheck',
    '        run: pnpm typecheck',
    '      - name: Test',
    '        run: pnpm test',
    '',
  ].join('\n'),
}, (dir) => {
  const result = runGuard(dir);
  assert.equal(result.code, 0, `a workflow of real jobs must pass:\n${result.stdout}`);
});

// 5. A verdict job that omits a gate must be rejected: otherwise that gate can
//    fail while the verdict reports success.
withFixture({
  'verdict.yml': [
    'name: Verdict',
    'on:',
    '  workflow_dispatch:',
    'jobs:',
    '  unit-tests:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Test',
    '        run: pnpm test',
    '  security-scan:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Scan',
    '        run: pnpm audit --prod',
    '  release-verdict:',
    '    needs: [unit-tests]',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Verdict',
    '        run: exit 1',
    '',
  ].join('\n'),
}, (dir) => {
  const result = runGuard(dir);
  assert.equal(result.code, 1, 'an incomplete verdict must fail the guard');
  assert.match(result.stdout, /security-scan/, 'the violation must name the uncovered gate');
  assert.match(result.stdout, /release-verdict/, 'the violation must name the verdict job');
});

// 6. A verdict job that covers every other job must pass.
withFixture({
  'verdict-ok.yml': [
    'name: Verdict OK',
    'on:',
    '  workflow_dispatch:',
    'jobs:',
    '  unit-tests:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Test',
    '        run: pnpm test',
    '  security-scan:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Scan',
    '        run: pnpm audit --prod',
    '  release-verdict:',
    '    needs: [unit-tests, security-scan]',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: Verdict',
    '        run: exit 1',
    '',
  ].join('\n'),
}, (dir) => {
  const result = runGuard(dir);
  assert.equal(result.code, 0, `a complete verdict must pass:\n${result.stdout}`);
});

console.log('Workflow honesty guard tests: 6 passed, 0 failed');
