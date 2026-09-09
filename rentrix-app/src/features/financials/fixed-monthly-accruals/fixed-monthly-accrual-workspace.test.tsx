// @vitest-environment happy-dom
import { cleanup, fireEvent, render as renderView, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { AuthorizationContext } from '@/features/auth/permissions';

const mocks = vi.hoisted(() => ({
  authorization: null as AuthorizationContext | null,
  list: vi.fn(),
  execute: vi.fn(),
  reverse: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: mocks.authorization }),
}));
// The workspace renders amounts through the company-aware money formatter, so
// it reads the company settings contract. Mock it to the default contract to
// keep this suite hermetic; the real QueryClient below verifies invalidation.
vi.mock('@/features/settings/useCompanySettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/companySettings')>('@/lib/companySettings');
  return { useCompanySettingsContract: () => actual.defaultCompanySettingsContract };
});
vi.mock('./fixed-monthly-accrual-service', () => ({
  listFixedMonthlyAccruals: mocks.list,
  executeFixedMonthlyAccruals: mocks.execute,
  reverseFixedMonthlyAccrual: mocks.reverse,
}));

import { FixedMonthlyAccrualWorkspace } from './fixed-monthly-accrual-workspace';
let client: QueryClient;
function render(view: ReactElement) {
  return renderView(<QueryClientProvider client={client}>{view}</QueryClientProvider>);
}


function context(role: AuthorizationContext['role']): AuthorizationContext {
  return { userId: `user-${role}`, email: `${role.toLowerCase()}@test.local`, role };
}

const listResult = {
  dateFrom: '2024-02-01',
  dateTo: '2024-02-29',
  totalCount: 1,
  returnedCount: 1,
  truncated: false,
  netAmount: 3.448,
  taxAmount: 0,
  grossAmount: 3.448,
  reversedCount: 0,
  taxAuthorityStatus: 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
  accruals: [{
    id: 'accrual-1',
    ownerAgreementId: 'agreement-1',
    agreementVersionId: 'version-1',
    versionNo: 1,
    ownerName: 'مالك الاختبار',
    propertyName: 'عقار الاختبار',
    accrualDate: '2024-02-29',
    monthlyContractAmount: 100,
    monthlyAmountOmr: 100,
    netAmount: 3.448,
    taxAmount: 0,
    grossAmount: 3.448,
    taxAuthorityStatus: 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY',
    status: 'POSTED' as const,
    journalBatchId: 'batch-1',
    accountingPeriodId: 'period-1',
    postingDate: '2024-02-29',
    periodResolutionReason: 'EFFECTIVE_PERIOD_OPEN',
    latePosting: false,
    reversalId: null,
    reversalBatchId: null,
    reversalReason: null,
    reversedAt: null,
  }],
};

describe('fixed monthly accrual Arabic workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.list.mockResolvedValue(listResult);
  });

  afterEach(() => {
    cleanup();
    client.clear();
  });

  it.each(['ADMIN', 'MANAGER', 'ACCOUNTANT'] as const)(
    'shows execution and reversal actions to %s without implementation copy',
    async (role) => {
      mocks.authorization = context(role);
      render(<FixedMonthlyAccrualWorkspace />);

      expect(await screen.findByRole('button', { name: /احتساب الاستحقاقات/ })).toBeTruthy();
      const actionTrigger = await screen.findByRole('button', { name: /إجراءات استحقاق/ });
      fireEvent.click(actionTrigger);
      expect(await screen.findByRole('menuitem', { name: 'عكس' })).toBeTruthy();
      expect(screen.getByText('مسجل')).toBeTruthy();
      expect(screen.getByText(/توجد استحقاقات تحتاج مراجعة ضريبية/)).toBeTruthy();
      expect(screen.getAllByText('الصافي').length).toBeGreaterThan(0);
      expect(screen.getAllByText('الضريبة').length).toBeGreaterThan(0);
      expect(screen.getAllByText('الإجمالي').length).toBeGreaterThan(0);
      expect(document.body.textContent).not.toContain('FIXED_MONTHLY');
      expect(document.body.textContent).not.toContain('DAILY_ACCRUAL');
      expect(document.body.textContent).not.toContain('2100');
      expect(document.body.textContent).not.toContain('نسخة 1');
      await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    },
  );

  it('hides all financial mutation affordances from a role without the capabilities', async () => {
    mocks.authorization = context('USER');
    render(<FixedMonthlyAccrualWorkspace />);

    expect((await screen.findAllByText('عقار الاختبار')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /احتساب الاستحقاقات/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /عكس/ })).toBeNull();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.reverse).not.toHaveBeenCalled();
  });

  it('does not echo a backend failure to the operator', async () => {
    mocks.authorization = context('ADMIN');
    mocks.list.mockRejectedValueOnce(new Error('RPC_FAILED relation internal_schema.accruals permission denied'));
    render(<FixedMonthlyAccrualWorkspace />);

    expect(await screen.findByText('تعذر تحميل سجل الاستحقاقات. تحقق من الاتصال ثم أعد المحاولة.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('RPC_FAILED');
    expect(document.body.textContent).not.toContain('internal_schema');
    expect(document.body.textContent).not.toContain('permission denied');
  });
  it.each([false, true])('invalidates tax/accounting projections after accrual execution, uncertain=%s', async uncertain => {
    mocks.authorization = context('ADMIN');
    if (uncertain) mocks.execute.mockRejectedValue(new Error('response lost'));
    else mocks.execute.mockResolvedValue({ createdDays: 1, idempotentDays: 0, grossAmount: 10 });
    const key = ['reports-authority', 'subledger-gl-reconciliation', '2026-09-09'];
    client.setQueryData(key, { previous: true });
    render(<FixedMonthlyAccrualWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /احتساب الاستحقاقات/ }));
    await waitFor(() => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('invalidates the same projections after a compensating reversal', async () => {
    mocks.authorization = context('ACCOUNTANT');
    mocks.reverse.mockResolvedValue({ accrualId: 'accrual-1' });
    const key = ['financialReports', 'vatReturn', { dateFrom: '2026-09-01', dateTo: '2026-09-30' }];
    client.setQueryData(key, { previous: true });
    render(<FixedMonthlyAccrualWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /إجراءات استحقاق/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'عكس' }));
    fireEvent.change(screen.getByLabelText('السبب'), { target: { value: 'تصحيح الاستحقاق' } });
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد العكس' }));
    await waitFor(() => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(mocks.reverse).toHaveBeenCalledWith('accrual-1', 'تصحيح الاستحقاق', expect.any(String));
  });

  it.each(['VERSIONED_FEE_TREATMENT', 'NO_ACCRUALS'])('does not label %s as missing tax configuration', async status => {
    mocks.authorization = context('ACCOUNTANT');
    mocks.list.mockResolvedValue({ ...listResult, taxAuthorityStatus: status,
      ...(status === 'NO_ACCRUALS' ? { totalCount: 0, returnedCount: 0, accruals: [] } : {
        accruals: listResult.accruals.map(row => ({ ...row, taxAuthorityStatus: status })),
      }),
    });
    render(<FixedMonthlyAccrualWorkspace />);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    await screen.findByText(status === 'NO_ACCRUALS' ? 'لا توجد استحقاقات' : 'مسجل');
    expect(screen.queryByText(/توجد استحقاقات تحتاج مراجعة ضريبية/)).toBeNull();
    expect(screen.queryByText(/الضريبة غير محتسبة حاليًا/)).toBeNull();
  });

});
