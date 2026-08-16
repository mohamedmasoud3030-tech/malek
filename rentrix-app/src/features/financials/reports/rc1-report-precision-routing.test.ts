import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const wp05StatementsSql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20260814040001_wp05_gap014_cashflow_statements.sql'),
  'utf8',
);
const accountingService = readFileSync(
  join(process.cwd(), 'src', 'features', 'financials', 'reports', 'accounting-reports-service.ts'),
  'utf8',
);
const financialStatementsService = readFileSync(
  join(process.cwd(), 'src', 'features', 'financials', 'reports', 'financial-statements-service.ts'),
  'utf8',
);

describe('RC1 financial report precision routing', () => {
  it('keeps legacy report signatures as 3dp GL-wrapper compatibility routes', () => {
    expect(wp05StatementsSql).toContain('return public.wp05_rpt_trial_balance_gl(p_as_of);');
    expect(wp05StatementsSql).toContain('return public.wp05_rpt_balance_sheet_gl(p_as_of);');
    expect(wp05StatementsSql).toContain('return public.wp05_rpt_profit_loss_gl(p_from, p_to);');
    expect(wp05StatementsSql).toContain('v_gl := public.wp05_rpt_cash_flow_gl(p_from_date, p_to_date);');
    expect(wp05StatementsSql).toContain('public.wp05_round_omr');
  });

  it('routes current accounting/report services only through wrappers that delegate to wp05 GL output', () => {
    expect(accountingService).toContain("'rpt_trial_balance'");
    expect(accountingService).toContain("'rpt_income_statement'");
    expect(accountingService).toContain("'rpt_balance_sheet'");
    expect(financialStatementsService).toContain("'rpt_cash_flow'");
    expect(accountingService).not.toContain('rpt_financial_summary');
    expect(financialStatementsService).not.toContain('rpt_financial_summary');
  });
});
