import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const full = resolve(directory, entry);
    if (statSync(full).isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(entry)) walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const SOURCE_ROOT = resolve(__dirname, '../../');
// These are accounting system-of-record tables. Their invariants cannot be
// reproduced safely in the browser, so all changes must use an atomic RPC.
const FINANCIAL_TABLES = ['journal_entries', 'invoices', 'invoice_items', 'payments', 'payment_allocations', 'tenant_deposits'];
const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete'];

describe('core financial writes are routed through atomic RPCs', () => {
  it('detects raw writes to protected financial tables in frontend source', () => {
    const offenders: string[] = [];
    for (const file of walk(SOURCE_ROOT)) {
      const source = readFileSync(file, 'utf8');
      for (const table of FINANCIAL_TABLES) for (const method of WRITE_METHODS) {
        const pattern = new RegExp(`\\.from\\(\\s*['\"]${table}['\"]\\s*\\)[\\s\\S]{0,180}?\\.${method}\\(`);
        if (pattern.test(source)) offenders.push(`${file.replace(SOURCE_ROOT, '')}: ${table}.${method}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
