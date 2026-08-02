import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), '..', 'supabase', 'migrations', '20260713000007_add_update_expense_with_journal_atomic.sql'), 'utf8');

describe('update_expense_with_journal_atomic ledger contract', () => {
  it('locks the posted expense and is idempotent before it changes the ledger', () => {
    expect(sql).toContain("PERFORM pg_advisory_xact_lock(hashtextextended('update_expense:' || v_expense_id, 0));");
    expect(sql).toContain('FOR UPDATE;');
    expect(sql).toContain("operation_name = 'update_expense_with_journal_atomic'");
    expect(sql).toContain("VALUES ('update_expense_with_journal_atomic', v_request_id, v_result)");
  });

  it('uses a complete reversal and replacement: debit equals credit in every generated pair', () => {
    // An amount change cannot mutate a posted amount in place: it must first
    // reverse the old DEBIT/CREDIT pair, then post a matching pair at the new amount.
    expect(sql).toContain("v_expense_account_id, v_old_amount, 'CREDIT'");
    expect(sql).toContain("v_cash_account_id, v_old_amount, 'DEBIT'");
    expect(sql).toContain("v_expense_account_id, v_new_amount, 'DEBIT'");
    expect(sql).toContain("v_cash_account_id, v_new_amount, 'CREDIT'");
    expect(sql).toContain("IF v_amount_diff <> 0 THEN");
    expect(sql).toContain("IF v_new_amount <= 0 THEN");
  });

  it('does not expose a raw browser update path for posted expense values', () => {
    const service = readFileSync(join(process.cwd(), 'src', 'features', 'financials', 'expenses', 'expenseService.ts'), 'utf8');
    expect(service).toContain("'update_expense_with_journal_atomic'");
    expect(service).not.toMatch(/\.from\(['"]expenses['"]\)[\s\S]{0,180}\.update\(/);
  });
});
