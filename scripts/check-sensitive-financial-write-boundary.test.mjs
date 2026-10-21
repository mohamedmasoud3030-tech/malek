import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { findViolations, SENSITIVE_TABLES } from './check-sensitive-financial-write-boundary.mjs';

test('detects a direct insert into a sensitive table', () => {
  const source = `await supabase.from('payments').insert({ amount: 1 });`;
  const violations = findViolations(source, 'x.ts');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].table, 'payments');
  assert.equal(violations[0].operation, 'insert');
});

test('detects update, delete and upsert, including double quotes', () => {
  for (const operation of ['update', 'delete', 'upsert']) {
    const source = `supabase.from("invoices").${operation}({ id });`;
    const violations = findViolations(source, 'x.ts');
    assert.equal(violations.length, 1, `${operation} should be detected`);
    assert.equal(violations[0].operation, operation);
  }
});

test('allows reads from a sensitive table', () => {
  const source = `const { data } = await supabase.from('payments').select('*').eq('id', id);`;
  assert.deepEqual(findViolations(source, 'x.ts'), []);
});

test('allows RPC writes, which are the sanctioned path', () => {
  const source = `await supabase.rpc('post_receipt_atomic', { p_receipt_id: id });`;
  assert.deepEqual(findViolations(source, 'x.ts'), []);
});

test('does not flag non-sensitive tables', () => {
  const source = `supabase.from('maintenance_requests').insert({ title });`;
  assert.deepEqual(findViolations(source, 'x.ts'), []);
});

test('attributes the violation to the sensitive table, not the chained table', () => {
  // The segment for `invoices` stops at the next `.from(`, so the mutation belongs to `invoices`.
  const source = [
    `supabase.from('invoices').insert({ id });`,
    `supabase.from('properties').select('*');`,
  ].join('\n');
  const violations = findViolations(source, 'x.ts');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].table, 'invoices');
  assert.equal(violations[0].line, 1);
});

test('reports the correct line number', () => {
  const source = ['const a = 1;', 'const b = 2;', `await supabase.from('receipts').delete();`].join('\n');
  const violations = findViolations(source, 'x.ts');
  assert.equal(violations[0].line, 3);
});

test('covers every sensitive table name', () => {
  for (const table of SENSITIVE_TABLES) {
    const violations = findViolations(`supabase.from('${table}').insert({});`, 'x.ts');
    assert.equal(violations.length, 1, `${table} must be protected`);
  }
});

test('CLI fails closed with a violation and passes when clean', () => {
  const script = new URL('./check-sensitive-financial-write-boundary.mjs', import.meta.url).pathname;
  const root = mkdtempSync(join(tmpdir(), 'sensitive-boundary-'));

  const cleanDir = join(root, 'clean');
  mkdirSync(cleanDir, { recursive: true });
  writeFileSync(join(cleanDir, 'ok.ts'), `supabase.from('invoices').select('*');`);
  const clean = execFileSync('node', [script, '--root', cleanDir], { encoding: 'utf8' });
  assert.match(clean, /PASS/);

  const badDir = join(root, 'bad');
  mkdirSync(badDir, { recursive: true });
  writeFileSync(join(badDir, 'bad.ts'), `supabase.from('journal_lines').insert({ debit: 1 });`);
  assert.throws(
    () => execFileSync('node', [script, '--root', badDir], { encoding: 'utf8', stdio: 'pipe' }),
    (error) => error.status === 1 && String(error.stderr).includes('journal_lines'),
  );
});

test('ignores test files and fixtures under the scan root', () => {
  const script = new URL('./check-sensitive-financial-write-boundary.mjs', import.meta.url).pathname;
  const root = mkdtempSync(join(tmpdir(), 'sensitive-boundary-ignore-'));
  writeFileSync(join(root, 'payments.test.ts'), `supabase.from('payments').insert({});`);
  writeFileSync(join(root, 'payments.ts'), `supabase.from('payments').select('*');`);
  const output = execFileSync('node', [script, '--root', root], { encoding: 'utf8' });
  assert.match(output, /PASS/);
});
