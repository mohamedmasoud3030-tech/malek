import { describe, expect, it } from 'vitest';
import { buildAiAssistantResponsePresentation } from './ai-assistant-response-model';
import type { AiAssistantContext, AiAssistantResponse } from './types';

function context(): AiAssistantContext {
  return {
    asOf: '2026-09-03',
    sampleLimit: 500,
    overdueInvoices: {
      invoiceCount: 4,
      totalOutstanding: 910.125,
      oldestDueDate: '2026-08-01',
      topInvoices: [],
      dueTodayCount: 1,
      dueTodayAmount: 125.5,
    },
    contractRenewals: {
      lookaheadDays: 90,
      contractCount: 2,
      totalRentAmount: 800,
      upcomingContracts: [
        { contractId: 'c1', propertyId: 'p1', tenantId: 't1', unitId: 'u1', endDate: '2026-09-08', rentAmount: 400 },
      ],
    },
    propertyFinancialSnapshot: {
      propertyCount: 2,
      activePropertyCount: 2,
      unitCount: 10,
      occupiedUnitCount: 8,
      vacantUnitCount: 2,
      occupancyRate: 80,
      outstandingInvoiceAmount: 910.125,
      expensesLast90Days: 300,
    },
    reportSummary: {
      invoicesLast30Days: 10,
      invoiceAmountLast30Days: 1500,
      paymentsLast30Days: 8,
      paymentAmountLast30Days: 1200,
      expensesLast30Days: 3,
      expenseAmountLast30Days: 200,
    },
    surface: {
      route: '/contracts/c1',
      entityType: 'contract',
      entityId: 'c1',
      entityLabel: 'أحمد',
      section: 'contracts',
    },
    entity: {
      type: 'contract',
      id: 'c1',
      name: 'أحمد',
      tenantName: 'أحمد',
      propertyName: 'برج صحار',
      rentAmount: 400,
      endDate: '2026-09-08',
      outstandingAmount: 250,
      oldestOverdueDate: '2026-08-20',
    },
    maintenanceSnapshot: {
      openCount: 3,
      inProgressCount: 1,
      urgentOpenCount: 1,
      stalledCount: 1,
      awaitingClosureCount: 0,
      oldestOpenAgeDays: 20,
      topRequests: [],
    },
  };
}

function response(): AiAssistantResponse {
  return {
    reply: 'رد تشغيلي',
    context: context(),
    grounded: true,
    caveats: [],
    source: 'deterministic',
  };
}

describe('buildAiAssistantResponsePresentation', () => {
  it('keeps attention concise and ordered from canonical signals', () => {
    const presentation = buildAiAssistantResponsePresentation(response(), 'generate_daily_brief');
    expect(presentation.mode).toBe('brief');
    expect(presentation.attention).toHaveLength(3);
    expect(presentation.attention[0]?.label).toContain('مستحق اليوم');
    expect(presentation.attention.some((item) => item.label.includes('صيانة'))).toBe(true);
    expect(presentation.attention.some((item) => item.label.includes('متأخرات'))).toBe(true);
  });

  it('offers only reviewable draft preparation for a contract that needs attention', () => {
    const presentation = buildAiAssistantResponsePresentation(response(), 'explain_current_surface');
    expect(presentation.mode).toBe('explanation');
    expect(presentation.contextLabel).toBe('أحمد');
    expect(presentation.suggestedActions.map((item) => item.action)).toEqual([
      'draft_tenant_payment_reminder',
      'draft_contract_renewal_followup',
    ]);
  });

  it('offers the owner financial position follow-up on owner dossiers without chaining on itself', () => {
    const ownerContext: AiAssistantContext = {
      ...context(),
      entity: {
        type: 'owner',
        id: 'o1',
        name: 'خالد',
        propertyCount: 2,
        activeContractCount: 2,
        outstandingAmount: 0,
      },
      surface: {
        route: '/owners/o1',
        entityType: 'owner',
        entityId: 'o1',
        entityLabel: 'خالد',
        section: 'owners',
      },
    };
    const presentation = buildAiAssistantResponsePresentation(
      { ...response(), context: ownerContext },
      'explain_current_surface',
    );
    expect(presentation.suggestedActions.map((item) => item.action)).toContain('explain_owner_financial_position');

    const selfPresentation = buildAiAssistantResponsePresentation(
      { ...response(), context: ownerContext },
      'explain_owner_financial_position',
    );
    expect(selfPresentation.suggestedActions.map((item) => item.action)).not.toContain('explain_owner_financial_position');
  });

  it('does not chain another action from a draft response', () => {
    const presentation = buildAiAssistantResponsePresentation(response(), 'draft_tenant_payment_reminder');
    expect(presentation.mode).toBe('draft');
    expect(presentation.attention).toEqual([]);
    expect(presentation.suggestedActions).toEqual([]);
  });

  it('presents advisory replies with the advisory label, no data chips, and a pull-back to live data', () => {
    const presentation = buildAiAssistantResponsePresentation({ ...response(), kind: 'advisory' });
    expect(presentation.mode).toBe('advisory');
    expect(presentation.modeLabel).toBe('نصيحة إرشادية');
    // Advisory talk is about the market, not the open entity or its risks.
    expect(presentation.contextLabel).toBeNull();
    expect(presentation.attention).toEqual([]);
    expect(presentation.suggestedActions).toEqual([
      { action: 'generate_daily_brief', title: 'شوف الوضع الحالي', prompt: 'إيه المهم دلوقتي؟' },
    ]);
  });

  it('keeps the data presentation untouched when kind is data or absent', () => {
    expect(buildAiAssistantResponsePresentation({ ...response(), kind: 'data' }, 'explain_current_surface').mode).toBe('explanation');
    expect(buildAiAssistantResponsePresentation(response(), 'explain_current_surface').modeLabel).toBe('شرح السياق');
  });

  it('surfaces context trimming as a transparency chip on data answers only', () => {
    const trimmed = buildAiAssistantResponsePresentation(
      { ...response(), contextTrimmed: true },
      'summarize_month',
    );
    expect(trimmed.attention.some((item) => item.tone === 'info' && item.label.includes('اقتُطع'))).toBe(true);

    const untrimmed = buildAiAssistantResponsePresentation(response(), 'summarize_month');
    expect(untrimmed.attention.some((item) => item.label.includes('اقتُطع'))).toBe(false);

    // Advisory replies never carry data-context trimming.
    const advisory = buildAiAssistantResponsePresentation(
      { ...response(), kind: 'advisory', contextTrimmed: true },
    );
    expect(advisory.attention).toEqual([]);
  });
});
