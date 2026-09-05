// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StatementsSection } from './StatementsSection';
import type { OwnerStatementReport } from '@/features/financials/reports/financialReportsService';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/features/reports/accounting-report-authority', () => ({
  useAuthoritativeGlCashFlow: () => ({
    data: null,
    error: null,
    isLoading: false,
  }),
}));

const ownerStatement: OwnerStatementReport = {
  ownerName: 'سالم الحارثي',
  commissionType: 'RATE',
  commissionValue: 5,
  transactions: [
    {
      date: '2026-02-10',
      details: 'إيجار شقة 101',
      type: 'payment',
      propertyName: 'برج الشروق',
      gross: 1000,
      deduction: 50,
      net: 950,
    },
  ],
  totalGross: 1000,
  totalDeductions: 50,
  totalNet: 950,
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  error: null,
};

function renderOwnerSection(
  overrides: {
    ownerStatement?: OwnerStatementReport | undefined;
    selectedOwnerId?: string;
    focus?: 'all' | 'owner';
  } = {},
) {
  const hasStatementOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'ownerStatement',
  );
  const statementValue = hasStatementOverride
    ? overrides.ownerStatement
    : ownerStatement;
  return render(
    <StatementsSection
      financialSummary={undefined}
      vatReturn={undefined}
      tenantStatement={undefined}
      ownerStatement={statementValue}
      selectedContractId=""
      selectedOwnerId={
        overrides.selectedOwnerId !== undefined
          ? overrides.selectedOwnerId
          : 'o-01'
      }
      tenantStatementError={undefined}
      ownerStatementError={undefined}
      isTenantStatementLoading={false}
      isOwnerStatementLoading={false}
      isLoading={false}
      filters={{
        from: '2026-02-01',
        to: '2026-02-28',
        propertyId: undefined,
        ownerId: 'o-01',
      }}
      focus={overrides.focus}
    />,
  );
}

describe('StatementsSection owner body boundary', () => {
  afterEach(() => cleanup());

  it('renders the authoritative owner statement without a second product-output toolbar', () => {
    renderOwnerSection();

    expect(screen.getByText('كشف حساب المالك')).toBeDefined();
    expect(screen.getByText('سالم الحارثي')).toBeDefined();
    expect(screen.getByText('إيجار شقة 101')).toBeDefined();
    expect(
      screen.queryByRole('button', {
        name: /تنزيل كشف المالك PDF|خيارات إخراج كشف المالك/,
      }),
    ).toBeNull();
  });

  it('keeps the owner body truthfully empty until the authoritative statement is loaded', () => {
    renderOwnerSection({ ownerStatement: undefined });

    expect(
      screen.getByText('لا توجد بيانات كشف مالك معتمدة للفترة المحددة.'),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', {
        name: /تنزيل كشف المالك PDF|خيارات إخراج كشف المالك/,
      }),
    ).toBeNull();
  });

  it('does not create a running balance when the owner authority lacks an opening balance', () => {
    renderOwnerSection({ focus: 'owner' });

    expect(screen.queryByText('الرصيد الجاري')).toBeNull();
    expect(
      screen.getByText(
        /الرصيد الجاري لا يُعرض لأن سلطة كشف المالك الحالية لا توفّر رصيد افتتاح معتمدًا/,
      ),
    ).toBeDefined();
  });
});
