import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

describe('accounting reports normalizers and reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes a balanced trial balance and reconciles debits to credits', async () => {
    const { normalizeTrialBalanceReport } = await import('./financialReportsService');

    const payload = {
      as_of: '2026-06-30',
      accounts: [
        { code: '1111', name: 'Cash', type: 'asset', balance_type: 'debit', balance: 1000 },
        { code: '1201', name: 'Tenant Receivables', type: 'asset', balance_type: 'debit', balance: 200 },
        { code: '6100', name: 'Operating Expenses', type: 'expense', balance_type: 'debit', balance: 500 },
        { code: '4000', name: 'Rental Revenue', type: 'revenue', balance_type: 'credit', balance: 1500 },
        { code: '2000', name: 'Owner Payables', type: 'liability', balance_type: 'credit', balance: 300 },
        { code: '2100', name: 'VAT Payable', type: 'liability', balance_type: 'credit', balance: 100 },
        { code: '3000', name: 'Retained Earnings', type: 'equity', balance_type: 'credit', balance: -200 },
      ],
      total_debits: 1700,
      total_credits: 1700,
      is_balanced: true,
    };

    const report = normalizeTrialBalanceReport(payload);
    expect(report.asOf).toBe('2026-06-30');
    expect(report.accounts).toHaveLength(7);
    expect(report.accounts[6]).toMatchObject({ code: '3000', balanceType: 'credit', balance: -200 });
    expect(report.totalDebits).toBe(1700);
    expect(report.totalCredits).toBe(1700);
    expect(report.isBalanced).toBe(true);

    const sumDebits = report.accounts.filter((a) => a.balanceType === 'debit').reduce((t, a) => t + a.balance, 0);
    const sumCredits = report.accounts.filter((a) => a.balanceType === 'credit').reduce((t, a) => t + a.balance, 0);
    expect(sumDebits).toBe(report.totalDebits);
    expect(sumCredits).toBe(report.totalCredits);
  });

  it('surfaces an unbalanced trial balance without throwing', async () => {
    const { normalizeTrialBalanceReport } = await import('./financialReportsService');
    const report = normalizeTrialBalanceReport({
      as_of: '2026-06-30',
      accounts: [],
      total_debits: 100,
      total_credits: 90,
      is_balanced: false,
    });
    expect(report.isBalanced).toBe(false);
    expect(report.totalDebits).toBe(100);
    expect(report.totalCredits).toBe(90);
  });

  it('normalizes an income statement and reconciles net income', async () => {
    const { normalizeIncomeStatementReport } = await import('./financialReportsService');
    const payload = {
      period: { from: '2026-06-01', to: '2026-06-30' },
      revenue: [{ label: 'الإيرادات التشغيلية', amount: 1500 }],
      total_revenue: 1500,
      expenses: [{ label: 'صيانة', amount: 300 }, { label: 'مرافق', amount: 200 }],
      total_expenses: 500,
      net_income: 1000,
    };
    const report = normalizeIncomeStatementReport(payload);
    expect(report.period).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    expect(report.totalRevenue).toBe(1500);
    expect(report.totalExpenses).toBe(500);
    expect(report.netIncome).toBe(1000);
    expect(report.revenue[0].label).toBe('الإيرادات التشغيلية');
    expect(report.expenses).toHaveLength(2);
    expect(report.totalRevenue - report.totalExpenses).toBe(report.netIncome);
  });

  it('normalizes a balance sheet and reconciles assets to liabilities plus equity', async () => {
    const { normalizeBalanceSheetReport } = await import('./financialReportsService');
    const payload = {
      as_of: '2026-06-30',
      assets: [
        { code: '1111', name: 'Cash', amount: 1000 },
        { code: '1201', name: 'Tenant Receivables', amount: 200 },
      ],
      total_assets: 1200,
      liabilities: [
        { code: '2000', name: 'Owner Payables', amount: 300 },
        { code: '2100', name: 'VAT Payable', amount: 100 },
      ],
      total_liabilities: 400,
      equity: [{ code: '3000', name: 'Retained Earnings', amount: 800 }],
      total_equity: 800,
      is_balanced: true,
    };
    const report = normalizeBalanceSheetReport(payload);
    expect(report.totalAssets).toBe(1200);
    expect(report.totalLiabilities).toBe(400);
    expect(report.totalEquity).toBe(800);
    expect(report.isBalanced).toBe(true);
    expect(report.totalAssets).toBe(report.totalLiabilities + report.totalEquity);
  });

  it('calls the three accounting RPCs with the correct argument shapes', async () => {
    const {
      getTrialBalanceReport,
      getIncomeStatementReport,
      getBalanceSheetReport,
    } = await import('./financialReportsService');

    supabaseMock.rpc.mockResolvedValueOnce({ data: { as_of: '2026-06-30', accounts: [], total_debits: 0, total_credits: 0, is_balanced: true }, error: null });
    await expect(getTrialBalanceReport('2026-06-30')).resolves.toMatchObject({ asOf: '2026-06-30' });
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('rpt_trial_balance', { p_as_of: '2026-06-30' });

    supabaseMock.rpc.mockResolvedValueOnce({ data: { period: { from: '2026-06-01', to: '2026-06-30' }, revenue: [], total_revenue: 0, expenses: [], total_expenses: 0, net_income: 0 }, error: null });
    await expect(getIncomeStatementReport({ dateFrom: '2026-06-01', dateTo: '2026-06-30' })).resolves.toMatchObject({ totalRevenue: 0 });
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('rpt_income_statement', { p_from: '2026-06-01', p_to: '2026-06-30' });

    supabaseMock.rpc.mockResolvedValueOnce({ data: { as_of: '2026-06-30', assets: [], total_assets: 0, liabilities: [], total_liabilities: 0, equity: [], total_equity: 0, is_balanced: true }, error: null });
    await expect(getBalanceSheetReport('2026-06-30')).resolves.toMatchObject({ asOf: '2026-06-30' });
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('rpt_balance_sheet', { p_as_of: '2026-06-30' });
  });
});
