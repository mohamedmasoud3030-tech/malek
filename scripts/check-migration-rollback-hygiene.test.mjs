#!/usr/bin/env node
// ============================================================================
// Tests for scripts/check-migration-rollback-hygiene.mjs
// ============================================================================
//
// Builds a series of throwaway git repositories that mimic a "base" main
// branch plus a candidate PR branch, then runs the guard script against
// each scenario and asserts PASS/FAIL as expected.
//
// Usage: node scripts/check-migration-rollback-hygiene.test.mjs
// ============================================================================

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const GUARD_SCRIPT = join(REPO_ROOT, 'scripts', 'check-migration-rollback-hygiene.mjs');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function gitOut(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function writeFile(cwd, relPath, content) {
  const full = join(cwd, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

function runGuard(cwd, baseRef) {
  const result = spawnSync('node', [GUARD_SCRIPT, '--base', baseRef], {
    cwd,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Sets up a fresh throwaway repo with an initial commit on `main` containing
 * the given base files, matching the migration hygiene guard's expectations
 * (git ls-tree / git diff against a resolvable ref).
 */
function makeRepo(baseFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'migration-hygiene-test-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@rentrix.dev']);
  git(dir, ['config', 'user.name', 'Test Harness']);

  for (const [relPath, content] of Object.entries(baseFiles)) {
    writeFile(dir, relPath, content);
  }
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);

  // The guard's Rule 6 check reads scripts/ci/run-supabase-database-gate.sh;
  // give every scenario a clean stand-in so that check is inert unless a
  // test explicitly wants to exercise it.
  if (!('scripts/ci/run-supabase-database-gate.sh' in baseFiles)) {
    writeFile(dir, 'scripts/ci/run-supabase-database-gate.sh', '#!/usr/bin/env bash\n# replays supabase/migrations only\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'gate script stand-in', '--allow-empty']);
  }

  git(dir, ['checkout', '-q', '-b', 'pr-branch']);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function commitChanges(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

const MANUAL_ROLLBACK_HEADER = (forwardFile) =>
  `-- Manual rollback for ${forwardFile}\n-- Not auto-applied; run by hand only.\n\nbegin;\ndrop function if exists public.example();\ncommit;\n`;

// ----------------------------------------------------------------------------
// 1. Clean forward migration → PASS
// ----------------------------------------------------------------------------
test('a clean new forward migration passes', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/migrations/20260805000000_add_example_index.sql',
    'create index if not exists example_id_idx on public.example (id);\n',
  );
  commitChanges(dir, 'add forward migration');

  const result = runGuard(dir, 'main');
  assert(result.status === 0, `expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  assert(result.stdout.includes('OK'), 'expected OK output');
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 2. New migration named with "rollback" → FAIL
// ----------------------------------------------------------------------------
test('a new migration filename containing "rollback" fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/migrations/20260805000000_rollback_example.sql',
    'drop table public.example;\n',
  );
  commitChanges(dir, 'add rollback-named migration');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 1'), `expected Rule 1 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 3. New migration with a manual-rollback style header → FAIL
// ----------------------------------------------------------------------------
test('a new migration with a manual-rollback header fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/migrations/20260805000000_fix_example.sql',
    '-- Manual rollback for 20260801000000_initial.sql\nbegin;\ndrop table public.example;\ncommit;\n',
  );
  commitChanges(dir, 'add migration with rollback header');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 2'), `expected Rule 2 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 4. Correct rollback script inside supabase/rollback/ → PASS
// ----------------------------------------------------------------------------
test('a well-formed rollback script in supabase/rollback/ passes', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/rollback/20260805000000_rollback_example.sql',
    MANUAL_ROLLBACK_HEADER('20260801000000_initial.sql'),
  );
  commitChanges(dir, 'add rollback script');

  const result = runGuard(dir, 'main');
  assert(result.status === 0, `expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 5. Rollback script without a manual header → FAIL
// ----------------------------------------------------------------------------
test('a rollback script without a manual warning header fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/rollback/20260805000000_rollback_example.sql',
    '-- Reverts 20260801000000_initial.sql\nbegin;\ndrop table public.example;\ncommit;\n',
  );
  commitChanges(dir, 'add rollback script without manual header');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 3'), `expected Rule 3 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 6. Legacy rollback-like migration in base, untouched → PASS with warning
// ----------------------------------------------------------------------------
test('an untouched legacy rollback-like migration on base passes with a warning', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
    'supabase/migrations/20260801000001_rollback_legacy_thing.sql':
      '-- Rollback for 20260731999999_legacy_thing.sql\nbegin;\ndrop function if exists public.legacy_thing();\ncommit;\n',
  });
  // PR branch makes an unrelated, compliant change only.
  writeFile(
    dir,
    'supabase/migrations/20260805000000_add_example_index.sql',
    'create index if not exists example_id_idx on public.example (id);\n',
  );
  commitChanges(dir, 'unrelated forward migration');

  const result = runGuard(dir, 'main');
  assert(result.status === 0, `expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  assert(result.stdout.includes('LEGACY WARNING'), `expected legacy warning, got:\n${result.stdout}`);
  assert(
    result.stdout.includes('20260801000001_rollback_legacy_thing.sql'),
    `expected legacy file to be named in warning, got:\n${result.stdout}`,
  );
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 7. Modification of a historical migration → FAIL
// ----------------------------------------------------------------------------
test('modifying a historical migration file fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/migrations/20260801000000_initial.sql',
    'create table public.example (id uuid primary key, extra text);\n',
  );
  commitChanges(dir, 'modify historical migration');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 5'), `expected Rule 5 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// 8. New forward corrective migration → PASS
// ----------------------------------------------------------------------------
test('a new forward corrective migration passes without touching history', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/migrations/20260805000000_fix_example_default.sql',
    'alter table public.example alter column id set default gen_random_uuid();\n',
  );
  commitChanges(dir, 'add forward corrective migration');

  const result = runGuard(dir, 'main');
  assert(result.status === 0, `expected exit 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// Extra: deleting a historical migration → FAIL
// ----------------------------------------------------------------------------
test('deleting a historical migration file fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
    'supabase/migrations/20260802000000_second.sql': 'create table public.second (id uuid primary key);\n',
  });
  rmSync(join(dir, 'supabase/migrations/20260802000000_second.sql'));
  commitChanges(dir, 'delete historical migration');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 5'), `expected Rule 5 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// Extra: renaming a historical migration → FAIL
// ----------------------------------------------------------------------------
test('renaming a historical migration file fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  git(dir, ['mv', 'supabase/migrations/20260801000000_initial.sql', 'supabase/migrations/20260801000000_initial_renamed.sql']);
  commitChanges(dir, 'rename historical migration');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 5'), `expected Rule 5 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// Extra: rollback file missing the migration reference → FAIL
// ----------------------------------------------------------------------------
test('a rollback script missing a migration reference fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/rollback/20260805000000_rollback_example.sql',
    '-- Manual rollback, not auto-applied.\nbegin;\ndrop table public.example;\ncommit;\n',
  );
  commitChanges(dir, 'add rollback script without migration reference');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 4'), `expected Rule 4 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// Extra: rollback file breaking the naming contract → FAIL
// ----------------------------------------------------------------------------
test('a rollback script with a non-conforming filename fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
  });
  writeFile(
    dir,
    'supabase/rollback/example_manual_fix.sql',
    MANUAL_ROLLBACK_HEADER('20260801000000_initial.sql'),
  );
  commitChanges(dir, 'add non-conforming rollback filename');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 4'), `expected Rule 4 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
// Extra: replay gate script pulled in from supabase/rollback/ → FAIL
// ----------------------------------------------------------------------------
test('a replay gate script referencing supabase/rollback fails', () => {
  const dir = makeRepo({
    'supabase/migrations/20260801000000_initial.sql': 'create table public.example (id uuid primary key);\n',
    'scripts/ci/run-supabase-database-gate.sh': '#!/usr/bin/env bash\n# replays supabase/migrations only\n',
  });
  writeFile(
    dir,
    'scripts/ci/run-supabase-database-gate.sh',
    '#!/usr/bin/env bash\nfor f in supabase/migrations/*.sql supabase/rollback/*.sql; do :; done\n',
  );
  commitChanges(dir, 'wire rollback into replay gate');

  const result = runGuard(dir, 'main');
  assert(result.status !== 0, 'expected non-zero exit');
  assert(result.stderr.includes('Rule 6'), `expected Rule 6 violation, got:\n${result.stderr}`);
  cleanup(dir);
});

// ----------------------------------------------------------------------------
console.log('');
console.log(`Migration hygiene guard tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}
