#!/usr/bin/env node
// ============================================================================
// Test: check-sensitive-financial-write-boundary.mjs
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

const SCRIPT = join(import.meta.dirname, 'check-sensitive-financial-write-boundary.mjs');

function makeTmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'sensitive-guard-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@test.invalid'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'pipe' });
  // Copy the script into the temp repo.
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  const scriptContent = execFileSync('cat', [SCRIPT], { encoding: 'utf8' });
  writeFileSync(join(dir, 'scripts', 'check-sensitive-financial-write-boundary.mjs'), scriptContent);
  // Create the expected directory structure.
  mkdirSync(join(dir, 'rentrix-app', 'src'), { recursive: true });
  writeFileSync(join(dir, 'rentrix-app', 'src', '.gitkeep'), '');
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'pipe' });
  return dir;
}

function getHead(dir) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

function run(dir, baseRef) {
  return execFileSync('node', [join(dir, 'scripts', 'check-sensitive-financial-write-boundary.mjs'), '--base', baseRef], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function write(dir, path, content) {
  const full = join(dir, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}

function commit(dir) {
  execFileSync('git', ['add', '.'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'test'], { cwd: dir, stdio: 'pipe' });
}

describe('check-sensitive-financial-write-boundary', () => {
  it('exits cleanly when no new sensitive writes are added', () => {
    const dir = makeTmpRepo();
    const base = getHead(dir);
    write(dir, 'rentrix-app/src/safe.ts', `export const x = 1;\n`);
    commit(dir);
    const out = run(dir, base);
    assert.match(out, /OK/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('detects new .from(payments).insert writes', () => {
    const dir = makeTmpRepo();
    const base = getHead(dir);
    write(dir, 'rentrix-app/src/violation.ts', `supabase.from('payments').insert({ amount: 100 });\n`);
    commit(dir);
    try {
      run(dir, base);
      assert.fail('Expected non-zero exit');
    } catch (err) {
      assert.ok(err.status !== 0, 'Script should exit non-zero');
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('detects multiline .from(payments).insert writes', () => {
    const dir = makeTmpRepo();
    const base = getHead(dir);
    // Multiline pattern: .from() on one line, .insert() on the next
    write(dir, 'rentrix-app/src/violation.ts', `const { data } = await supabase\n  .from('payments')\n  .insert({ amount: 100 });\n`);
    commit(dir);
    try {
      run(dir, base);
      assert.fail('Expected non-zero exit');
    } catch (err) {
      assert.ok(err.status !== 0, 'Script should exit non-zero for multiline pattern');
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('allows .from(payments).select reads', () => {
    const dir = makeTmpRepo();
    const base = getHead(dir);
    write(dir, 'rentrix-app/src/reader.ts', `const { data } = await supabase.from('payments').select('*');\n`);
    commit(dir);
    const out = run(dir, base);
    assert.match(out, /OK/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('ignores test files', () => {
    const dir = makeTmpRepo();
    const base = getHead(dir);
    write(dir, 'rentrix-app/src/payments.test.ts', `supabase.from('payments').insert({ amount: 100 });\n`);
    commit(dir);
    const out = run(dir, base);
    assert.match(out, /OK/);
    rmSync(dir, { recursive: true, force: true });
  });
});
