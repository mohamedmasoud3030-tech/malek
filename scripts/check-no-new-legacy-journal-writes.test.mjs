#!/usr/bin/env node
// Tests for scripts/check-no-new-legacy-journal-writes.mjs.
// Uses throwaway git repositories so the guard is proven against a real base...HEAD diff.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SOURCE_REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const GUARD = join(SOURCE_REPO, 'scripts', 'check-no-new-legacy-journal-writes.mjs');
let passed = 0;
let failed = 0;
const failures = [];

function git(cwd, args) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

function write(cwd, path, content) {
  const full = join(cwd, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

function makeRepo(baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 's03-gl-write-guard-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'guard@malik.test']);
  git(dir, ['config', 'user.name', 'Guard Test']);
  for (const [path, content] of Object.entries(baseFiles)) write(dir, path, content);
  write(dir, 'README.md', 'base\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);
  git(dir, ['checkout', '-q', '-b', 'candidate']);
  return dir;
}

function commit(dir, message = 'candidate') {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function run(dir) {
  return spawnSync('node', [GUARD, '--base', 'main'], { cwd: dir, encoding: 'utf8' });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  let dir;
  try {
    dir = fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    failures.push({ name, error });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

function expectStatus(result, ok) {
  if (ok) {
    assert(result.status === 0, `expected success, got ${result.status}\n${result.stdout}\n${result.stderr}`);
    assert(result.stdout.includes('S03 GL Write Boundary Guard: OK'), 'expected OK marker');
  } else {
    assert(result.status !== 0, 'expected guard failure');
    assert(result.stderr.includes('S03 GL Write Boundary Guard: FAILED'), `missing failure marker:\n${result.stderr}`);
  }
}

test('new direct SQL INSERT into journal_entries fails, including multiline SQL', () => {
  const dir = makeRepo();
  write(dir, 'supabase/migrations/20260808000100_bad.sql', `
    insert\n      into public.journal_entries (id, amount)\n    values ('x', 1);\n  `);
  commit(dir);
  const result = run(dir);
  expectStatus(result, false);
  assert(result.stderr.includes('direct SQL write'), 'expected direct SQL reason');
  return dir;
});

test('new direct SQL UPDATE/DELETE against journal_entries fails', () => {
  const dir = makeRepo();
  write(dir, 'supabase/migrations/20260808000200_bad.sql', `
    update public.journal_entries set amount = 2 where id = 'x';
    delete from public.journal_entries where id = 'y';
  `);
  commit(dir);
  const result = run(dir);
  expectStatus(result, false);
  assert(result.stderr.includes('base=0, head=2'), `expected two new writes:\n${result.stderr}`);
  return dir;
});

test('journal_entries SELECT remains allowed', () => {
  const dir = makeRepo();
  write(dir, 'supabase/migrations/20260808000300_read_only.sql', `
    create or replace view public.example_read as
    select * from public.journal_entries where deleted_at is null;
  `);
  commit(dir);
  expectStatus(run(dir), true);
  return dir;
});

test('canonical post_journal_event business migration passes', () => {
  const dir = makeRepo();
  write(dir, 'supabase/migrations/20260808000400_canonical.sql', `
    create or replace function public.example_post(payload jsonb) returns jsonb
    language plpgsql security definer as $$
    begin
      return public.post_journal_event(payload);
    end;
    $$;
  `);
  commit(dir);
  expectStatus(run(dir), true);
  return dir;
});

test('untouched historical compatibility writer on base is grandfathered', () => {
  const dir = makeRepo({
    'supabase/migrations/20260701000000_legacy.sql': `
      insert into public.journal_entries (id) values ('legacy');
    `,
  });
  write(dir, 'supabase/migrations/20260808000500_unrelated.sql', 'create table public.unrelated(id uuid);\n');
  commit(dir);
  expectStatus(run(dir), true);
  return dir;
});

test('editing a production file without increasing its inherited write count passes this regression guard', () => {
  const path = 'rentrix-app/src/legacy-writer.ts';
  const dir = makeRepo({
    [path]: `const sql = "insert into public.journal_entries (id) values ('legacy')";\nexport const a = 1;\n`,
  });
  write(dir, path, `const sql = "insert into public.journal_entries (id) values ('legacy')";\nexport const a = 2;\n`);
  commit(dir);
  expectStatus(run(dir), true);
  return dir;
});

test("new Supabase .from('journal_entries').insert mutation fails", () => {
  const dir = makeRepo();
  write(dir, 'rentrix-app/src/new-writer.ts', `
    export async function bad(client) {
      return client.from('journal_entries').insert({ id: 'x' });
    }
  `);
  commit(dir);
  const result = run(dir);
  expectStatus(result, false);
  assert(result.stderr.includes("Supabase .from('journal_entries') mutation"), 'expected client mutation reason');
  return dir;
});

test("Supabase .from('journal_entries').select read remains allowed", () => {
  const dir = makeRepo();
  write(dir, 'rentrix-app/src/new-reader.ts', `
    export async function ok(client) {
      return client.from('journal_entries').select('*');
    }
  `);
  commit(dir);
  expectStatus(run(dir), true);
  return dir;
});

test('test and fixture files may contain legacy-write examples without affecting production guard', () => {
  const dir = makeRepo();
  write(dir, 'rentrix-app/src/s3/example.test.ts', `
    const example = "insert into public.journal_entries (id) values ('test-only')";
  `);
  write(dir, 'rentrix-app/src/fixtures/legacy.ts', `
    const fixture = "delete from public.journal_entries where id = 'fixture'";
  `);
  commit(dir);
  expectStatus(run(dir), true);
  return dir;
});

console.log(`\nS03 GL Write Boundary Guard tests: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  for (const { name, error } of failures) console.error(`  - ${name}: ${error.message}`);
  process.exitCode = 1;
}
