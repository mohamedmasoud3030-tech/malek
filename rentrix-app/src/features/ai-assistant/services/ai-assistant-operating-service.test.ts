import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiAssistantRequest, AiAssistantResponse } from '../types';

const requestBase = vi.fn();
const ownerAuthority = vi.fn();

vi.mock('./ai-assistant-service', () => ({
  requestAiAssistantResponse: (...args: unknown[]) => requestBase(...args),
}));

vi.mock('@/features/financials/services/owner-financial-authority-service', () => ({
  getOwnerFinancialAuthority: (...args: unknown[]) => ownerAuthority(...args),
}));

const request: AiAssistantRequest = {
  prompt: 'رصيد المالك ده كام؟',
  action: 'explain_current_surface',
  history: [],
  surface: {
    route: '/owners/owner-1',
    entityType: 'owner',
    entityId: 'owner-1',
    entityLabel: null,
    section: 'owners',
  },
};

function baseResponse(): AiAssistantResponse {
  return {
    reply: 'ملخص أساسي',
    grounded: true,
    caveats: ['قراءة فقط'],
    source: 'deterministic',
    context: {
      asOf: '2026-09-03',
      sampleLimit: 500,
      overdueInvoices: {
        invoiceCount: 2,
        totalOutstanding: 300,
        oldestDueDate: '2026-08-01',
        topInvoices: [],
        dueTodayCount: 0,
        dueTodayAmount: 0,
      },
      contractRenewals: {
        lookaheadDays: 90,
        contractCount: 0,
        totalRentAmount: 0,
        upcomingContracts: [],
      },
      propertyFinancialSnapshot: {
        propertyCount: 1,
        activePropertyCount: 1,
        unitCount: 3,
        occupiedUnitCount: 3,
        vacantUnitCount: 0,
        occupancyRate: 100,
        outstandingInvoiceAmount: 300,
        expensesLast90Days: 0,
      },
      reportSummary: {
        invoicesLast30Days: 0,
        invoiceAmountLast30Days: 0,
        paymentsLast30Days: 0,
        paymentAmountLast30Days: 0,
        expensesLast30Days: 0,
        expenseAmountLast30Days: 0,
      },
      surface: request.surface,
      entity: {
        type: 'owner',
        id: 'owner-1',
        name: 'محمد',
        propertyCount: 1,
        activeContractCount: 3,
        outstandingAmount: 300,
        oldestOverdueDate: '2026-08-01',
      },
    },
  };
}

beforeEach(() => {
  requestBase.mockReset();
  ownerAuthority.mockReset();
  requestBase.mockResolvedValue(baseResponse());
});

describe('requestAiOperatingResponse', () => {
  it('uses canonical owner authority for the current-period financial explanation', async () => {
    ownerAuthority.mockResolvedValue({
      position: {
        owner_id: 'owner-1',
        period: { net_payable: 512.345 },
        lifecycle_all_time: { remaining_payable: 222.111, approved_count: 2 },
        owner_funds: { held: 50.125 },
      },
      statement: { total_gross: 0, total_deductions: 0, total_net: null },
    });

    const { requestAiOperatingResponse } = await import('./ai-assistant-operating-service');
    const result = await requestAiOperatingResponse(request);

    expect(ownerAuthority).toHaveBeenCalledWith('owner-1', '2026-09-01', '2026-09-03');
    expect(result.reply).toContain('512.345 ر.ع.');
    expect(result.reply).toContain('222.111 ر.ع.');
    expect(result.reply).toContain('50.125 ر.ع.');
    expect(result.context.entity).toMatchObject({
      ownerCurrentPeriodNetPayable: 512.345,
      ownerRemainingPayable: 222.111,
      ownerHeldFunds: 50.125,
      ownerApprovedSettlements: 2,
    });
  });

  it('falls back to the base grounded response when owner authority is unavailable', async () => {
    ownerAuthority.mockRejectedValue(new Error('owner report unavailable'));
    const base = baseResponse();
    requestBase.mockResolvedValue(base);

    const { requestAiOperatingResponse } = await import('./ai-assistant-operating-service');
    await expect(requestAiOperatingResponse(request)).resolves.toEqual(base);
  });

  it('does not read owner authority for unrelated actions', async () => {
    const { requestAiOperatingResponse } = await import('./ai-assistant-operating-service');
    await requestAiOperatingResponse({ ...request, action: 'generate_daily_brief' });
    expect(ownerAuthority).not.toHaveBeenCalled();
  });
});
