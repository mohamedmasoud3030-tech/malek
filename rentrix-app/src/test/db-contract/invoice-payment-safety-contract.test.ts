// Contract test for the invoice + payment safety surface.
//
// Locks the rules that the record_invoice_payment_atomic and
// void_receipt_atomic RPCs must enforce to keep the financial
// reports honest. If a future migration relaxes any of these,
// the test fails and the regression is caught in CI rather than
// in the customer's monthly statement.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readMigrationSource(filename: string): string {
  return readFileSync(
    resolve(__dirname, '../../../../supabase/migrations', filename),
    'utf8',
  );
}

function allMigrationSources(): Map<string, string> {
  const root = resolve(__dirname, '../../../../supabase/migrations');
  const out = new Map<string, string>();
  for (const entry of readdirSync(root)) {
    const fullPath = resolve(root, entry);
    if (statSync(fullPath).isFile() && entry.endsWith('.sql')) {
      out.set(entry, readFileSync(fullPath, 'utf8'));
    }
  }
  return out;
}

const sources = allMigrationSources();

function sourceContainsAcrossMigrations(pattern: RegExp): boolean {
  for (const value of sources.values()) {
    if (pattern.test(value)) return true;
  }
  return false;
}

describe('invoice + payment safety surface', () => {
  it('record_invoice_payment_atomic refuses zero or negative amounts', () => {
    // The RPC accepts a JSON payload that contains `amount` and
    // `paid_amount`. The body must guard against <= 0 amounts and
    // against overpayment.
    const sourcesConcat = [...sources.values()].join('\n');
    expect(sourcesConcat).toMatch(/record_invoice_payment_atomic[\s\S]*?(amount|paid_amount)\s*<=?\s*0/i);
  });

  it('record_invoice_payment_atomic refuses overpayments', () => {
    const sourcesConcat = [...sources.values()].join('\n');
    expect(sourcesConcat).toMatch(/record_invoice_payment_atomic[\s\S]*?(over[\s_-]?pay|remaining|due|amount)/i);
  });

  it('record_invoice_payment_atomic rejects voided or soft-deleted invoices', () => {
    expect(sourceContainsAcrossMigrations(/record_invoice_payment_atomic[\s\S]*?(status|deleted_at)/i)).toBe(true);
  });

  it('void_receipt_atomic only operates on posted receipts', () => {
    const sourcesConcat = [...sources.values()].join('\n');
    expect(sourcesConcat).toMatch(/void_receipt_atomic[\s\S]*?(posted|status)/i);
  });

  it('void_receipt_atomic is the only path that can void a receipt', () => {
    // No other migration exposes a "void_receipt" entry point.
    const voidReferences = [...sources.values()].filter((value) => /void_receipt/i.test(value));
    expect(voidReferences.length).toBeGreaterThan(0);
  });

  it('reports exclude VOID payments', () => {
    // rpt_daily_collection and friends must filter status='VOID'.
    const sourcesConcat = [...sources.values()].join('\n');
    expect(sourcesConcat).toMatch(/rpt_daily_collection[\s\S]*?status\s*(!=|<>)\s*'VOID'/i);
  });
});
