import { beforeEach, expect, it, vi } from 'vitest';
import { getReconciliationReport } from '../accountingReportsFacade';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }));
const row = {
  reconciliation_class: 'TENANT_RECEIVABLES', account_no: '1201', account_name: 'Tenant AR',
  subledger_balance: '876.544', gl_balance: '1000.000', variance: '-123.456', abs_variance: '123.456',
  currency: 'OMR', reconciliation_status: 'FAIL', subledger_count: '1', gl_count: '2',
};
beforeEach(() => rpc.mockReset());
it.each([false, true])('preserves decimal strings and genuine variance (wrapped=%s)', async wrapped => {
  rpc.mockResolvedValue({ data: wrapped ? { rows: [row] } : [row], error: null });
  expect(await getReconciliationReport('2026-09-08')).toEqual([{
    ...row, subledger_balance: 876.544, gl_balance: 1000, variance: -123.456, abs_variance: 123.456,
    subledger_count: 1, gl_count: 2,
  }]);
  expect(rpc).toHaveBeenCalledWith('wp05_reconcile_all', { p_as_of: '2026-09-08' });
});
it.each([null, {}, { rows: {} }, [null], [{ ...row, variance: null }], [{ ...row, gl_balance: '' }],
  [{ ...row, gl_balance: 'not-money' }], [{ ...row, gl_balance: Infinity }],
  [{ ...row, subledger_count: -1 }], [{ ...row, reconciliation_status: 'UNKNOWN' }]])('rejects malformed evidence instead of inventing zero balances: %j', async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(getReconciliationReport()).rejects.toThrow();
});
it('retains an empty successful result as no evidence, not a synthetic PASS row', async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await getReconciliationReport()).toEqual([]);
});
it('propagates the original SQL authorization or historical-lineage error', async () => {
  const error = { message: 'AR_AS_OF_HISTORY_INCOMPLETE', code: '23514' };
  rpc.mockResolvedValue({ data: null, error });
  await expect(getReconciliationReport()).rejects.toBe(error);
});
