import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const trialBalanceSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260711000001_add_rpt_trial_balance.sql'),
  'utf8',
);
const incomeStatementSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260711000002_add_rpt_income_statement.sql'),
  'utf8',
);
const balanceSheetSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260711000003_add_rpt_balance_sheet.sql'),
  'utf8',
);

describe('accounting reports migration security contract', () => {
  it.each([
    ['rpt_trial_balance', trialBalanceSql, '(p_as_of date)', '(date)'],
    ['rpt_income_statement', incomeStatementSql, '(p_from date, p_to date)', '(date, date)'],
    ['rpt_balance_sheet', balanceSheetSql, '(p_as_of date)', '(date)'],
  ])('%s is SECURITY DEFINER with pinned search_path and no public/anon execute', (name, sql, createSig, revokeSig) => {
    expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${name}${createSig}`);
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path TO 'public', 'pg_temp'");
    expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}${revokeSig} FROM public, anon;`);
    expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${name}${revokeSig} TO authenticated, service_role;`);
  });

  it('reads from operational source tables only', () => {
    for (const sql of [trialBalanceSql, incomeStatementSql, balanceSheetSql]) {
      expect(sql).toContain('public.invoices');
    }
    expect(trialBalanceSql).toContain('public.payments');
    expect(trialBalanceSql).toContain('public.expenses');
    expect(trialBalanceSql).toContain('public.owner_settlements');
    expect(incomeStatementSql).toContain('public.expenses');
    expect(balanceSheetSql).toContain('public.payments');
    expect(balanceSheetSql).toContain('public.owner_settlements');
  });

  it('excludes deleted and voided rows from revenue/totals', () => {
    for (const sql of [trialBalanceSql, incomeStatementSql, balanceSheetSql]) {
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql.toLowerCase()).toContain("lower(status) <> 'void'".toLowerCase());
    }
    expect(trialBalanceSql.toLowerCase()).toContain("upper(status) <> 'VOID'".toLowerCase());
  });

  it('balance sheet and trial balance derive retained earnings as a balancing figure', () => {
    expect(trialBalanceSql).toContain('v_retained := v_cash + v_ar + v_expenses - v_revenue - v_owner_pay - v_vat;');
    expect(balanceSheetSql).toContain('v_equity := round(v_assets - v_liabilities, 2);');
    expect(balanceSheetSql).toContain("(v_assets = (v_liabilities + v_equity))");
  });
});
