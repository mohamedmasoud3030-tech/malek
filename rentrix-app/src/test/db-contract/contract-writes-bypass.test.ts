// Contract test: forbid raw contract writes from the frontend.
//
// The contract lifecycle (create / update / renew / terminate /
// soft delete) MUST go through the dedicated atomic RPCs. A raw
// .from('contracts').insert() or .update() would bypass the
// invariants enforced by the RPCs and the DB triggers (P0 hardening,
// PR #1301). This test scans the frontend source to ensure no
// regression slips in.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const fullPath = resolve(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const SOURCE_ROOT = resolve(__dirname, '../../');
const ALLOWED_TABLES = new Set<string>([
  // The contract table itself — no raw writes allowed.
  'contracts',
]);

describe('contract writes are routed through atomic RPCs', () => {
  const files = walk(SOURCE_ROOT);

  it('never calls .from("contracts").insert() outside test files', () => {
    const offenders: string[] = [];
    const pattern = /\.from\(\s*['"]contracts['"]\s*\)\s*[\s\S]{0,40}\.insert\(/;
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (pattern.test(content)) {
        offenders.push(file.replace(SOURCE_ROOT, ''));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never calls .from("contracts").update() outside test files', () => {
    const offenders: string[] = [];
    const pattern = /\.from\(\s*['"]contracts['"]\s*\)\s*[\s\S]{0,40}\.update\(/;
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (pattern.test(content)) {
        offenders.push(file.replace(SOURCE_ROOT, ''));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never calls .from("contracts").upsert() outside test files', () => {
    const offenders: string[] = [];
    const pattern = /\.from\(\s*['"]contracts['"]\s*\)\s*[\s\S]{0,40}\.upsert\(/;
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (pattern.test(content)) {
        offenders.push(file.replace(SOURCE_ROOT, ''));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('routes contract writes through the canonical RPCs', () => {
    // The frontend must reference at least these five RPCs somewhere.
    const allContent = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(allContent).toMatch(/create_contract_atomic/);
    expect(allContent).toMatch(/update_contract_atomic/);
    expect(allContent).toMatch(/renew_contract_atomic/);
    expect(allContent).toMatch(/terminate_contract_atomic/);
    expect(allContent).toMatch(/soft_delete_contract_atomic/);
  });
});
