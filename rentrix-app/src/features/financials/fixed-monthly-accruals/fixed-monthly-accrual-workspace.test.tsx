// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('./fixed-monthly-accrual-service', () => ({
  listFixedMonthlyAccruals: mocks.list,
  executeFixedMonthlyAccruals: mocks.execute,
  reverseFixedMonthlyAccrual: mocks.reverse,
}));

import { FixedMonthlyAccrualWorkspace } from './fixed-monthly-accrual-workspace';

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
    mocks.list.mockResolvedValue(listResult);
  });

  afterEach(() => {
    cleanup();
  });

  it.each(['ADMIN', 'MANAGER', 'ACCOUNTANT'] as const)(
    'shows execution and explicit compensating reversal affordances to %s',
    async (role) => {
      mocks.authorization = context(role);
      render(<FixedMonthlyAccrualWorkspace />);

      expect(await screen.findByRole('button', { name: /تنفيذ الاستحقاق/ })).toBeTruthy();
      expect(await screen.findByRole('button', { name: /عكس/ })).toBeTruthy();
      expect(screen.getByText('مرحّل')).toBeTruthy();
      expect(screen.getByText(/الضريبة غير مطبقة/)).toBeTruthy();
      expect(screen.getAllByText('الصافي').length).toBeGreaterThan(0);
      expect(screen.getAllByText('الضريبة').length).toBeGreaterThan(0);
      expect(screen.getAllByText('الإجمالي').length).toBeGreaterThan(0);
      await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1));
    },
  );

  it('hides all financial mutation affordances from a role without the capabilities', async () => {
    mocks.authorization = context('USER');
    render(<FixedMonthlyAccrualWorkspace />);

    expect((await screen.findAllByText('عقار الاختبار')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /تنفيذ الاستحقاق/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /عكس/ })).toBeNull();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.reverse).not.toHaveBeenCalled();
  });
});
