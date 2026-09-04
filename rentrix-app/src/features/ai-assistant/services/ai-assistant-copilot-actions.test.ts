import { describe, expect, it } from 'vitest';
import {
  deterministicResponse,
  fallbackResponse,
  validateAssistantRequest,
} from '../../../../../supabase/functions/_shared/ai-safety';
import type { AiAssistantContext, AiAssistantEntityContext } from '../types';

/**
 * Round-trip contract check for the contextual copilot: a context shaped
 * exactly like the one the client service now builds (v3 sections + surface +
 * entity) must pass the Edge Function's strict validation, and every
 * operational action must answer deterministically from it.
 */

const requestId = '018f4f36-7c7a-7c2a-8b1d-2c3d4e5f6071';

function fullContext(entity?: AiAssistantEntityContext): AiAssistantContext {
  return {
    asOf: '2026-09-02',
    sampleLimit: 500,
    overdueInvoices: {
      invoiceCount: 3,
      totalOutstanding: 180.5,
      oldestDueDate: '2026-07-01',
      topInvoices: [
        {
          invoiceId: 'inv-old',
          contractId: 'c1',
          dueDate: '2026-07-01',
          remainingAmount: 100.5,
          status: 'OPEN',
          tenantName: 'أحمد المعمري',
          propertyName: 'برج صحار',
          daysOverdue: 63,
        },
        {
          invoiceId: 'inv-p2',
          contractId: 'c2',
          dueDate: '2026-08-01',
          remainingAmount: 30,
          status: 'OPEN',
          tenantName: 'سالم البلوشي',
          propertyName: 'مجمع الباطنة',
          daysOverdue: 32,
        },
      ],
      dueTodayCount: 1,
      dueTodayAmount: 50,
    },
    contractRenewals: {
      lookaheadDays: 90,
      contractCount: 1,
      totalRentAmount: 200,
      upcomingContracts: [
        { contractId: 'c1', propertyId: 'p1', tenantId: 't1', unitId: 'u1', endDate: '2026-09-05', rentAmount: 200 },
      ],
    },
    propertyFinancialSnapshot: {
      propertyCount: 2,
      activePropertyCount: 2,
      unitCount: 3,
      occupiedUnitCount: 2,
      vacantUnitCount: 1,
      occupancyRate: 66.67,
      outstandingInvoiceAmount: 180.5,
      expensesLast90Days: 20,
    },
    reportSummary: {
      invoicesLast30Days: 2,
      invoiceAmountLast30Days: 80,
      paymentsLast30Days: 1,
      paymentAmountLast30Days: 75,
      expensesLast30Days: 1,
      expenseAmountLast30Days: 20,
    },
    surface: {
      route: '/properties/p1',
      entityType: entity ? entity.type : null,
      entityId: entity ? entity.id : null,
      entityLabel: entity?.name ?? null,
      section: 'properties',
    },
    entity,
    maintenanceSnapshot: {
      openCount: 1,
      inProgressCount: 1,
      urgentOpenCount: 1,
      stalledCount: 1,
      awaitingClosureCount: 1,
      oldestOpenAgeDays: 13,
      topRequests: [
        { requestId: 'm1', propertyName: 'برج صحار', issue: 'تسريب مياه', priority: 'urgent', status: 'open', openedDate: '2026-08-20', ageDays: 13 },
      ],
    },
    vacancyDetail: {
      topVacantUnits: [{ unitId: 'u2', propertyName: 'برج صحار', unitName: 'A2' }],
    },
    propertyPerformance: {
      topOutstanding: [
        { propertyId: 'p1', propertyName: 'برج صحار', outstandingAmount: 150.5, openInvoiceCount: 2 },
      ],
    },
    depositHeld: { totalHeld: 300, heldCount: 1 },
  };
}

function validate(action: string, entity?: AiAssistantEntityContext) {
  return validateAssistantRequest({
    requestId,
    prompt: 'سؤال تشغيلي عادي',
    action,
    context: JSON.parse(JSON.stringify(fullContext(entity))),
    history: [],
  });
}

const OPERATIONAL_ACTIONS = [
  'identify_riskiest_overdue_tenants',
  'list_contracts_needing_action_this_week',
  'locate_dormant_funds',
  'list_vacant_units_needing_followup',
  'identify_lowest_performing_properties',
  'list_overdue_or_critical_maintenance',
  'prioritize_office_actions_top5',
  'generate_daily_brief',
  'explain_current_surface',
  'summarize_expenses',
] as const;

describe('client context ↔ edge contract round trip', () => {
  it('accepts the full v3 client context (surface + entity + operational sections)', () => {
    const entity: AiAssistantEntityContext = {
      type: 'property', id: 'p1', name: 'برج صحار', status: 'active',
      unitCount: 2, occupiedUnitCount: 1, activeContractCount: 1, monthlyRentAmount: 200,
      outstandingAmount: 150.5, oldestOverdueDate: '2026-07-01',
    };
    const result = validate('explain_current_surface', entity);
    expect(result.ok).toBe(true);
  });

  it.each(OPERATIONAL_ACTIONS)('%s answers deterministically, grounded, in Arabic', (action) => {
    const result = validate(action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const output = deterministicResponse(result.value);
    expect(output).not.toBeNull();
    expect(output?.grounded).toBe(true);
    expect(output?.answer).toMatch(/[\u0600-\u06ff]/);
  });

  it('speaks OMR amounts with three decimals in monetary answers', () => {
    const result = validate('identify_riskiest_overdue_tenants');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const output = deterministicResponse(result.value);
    expect(output?.answer).toContain('100.500 ر.ع.');
    expect(output?.answer).toContain('أحمد المعمري');
  });
});

describe('entity-aware explain_current_surface', () => {
  const cases: Array<[AiAssistantEntityContext, string]> = [
    [
      { type: 'property', id: 'p1', name: 'برج صحار', unitCount: 2, occupiedUnitCount: 1, activeContractCount: 1, monthlyRentAmount: 200, outstandingAmount: 150.5, oldestOverdueDate: '2026-07-01' },
      'برج صحار',
    ],
    [
      { type: 'unit', id: 'u2', name: 'A2', status: 'available', propertyName: 'برج صحار', rentAmount: 120, outstandingAmount: 0 },
      'A2',
    ],
    [
      { type: 'contract', id: 'c1', name: 'أحمد المعمري', tenantName: 'أحمد المعمري', propertyName: 'برج صحار', rentAmount: 200, startDate: '2025-09-21', endDate: '2026-09-20', outstandingAmount: 150.5, oldestOverdueDate: '2026-07-01', nextDueDate: '2026-09-02' },
      'أحمد المعمري',
    ],
    [
      { type: 'tenant', id: 't1', name: 'أحمد المعمري', activeContractCount: 1, outstandingAmount: 150.5, oldestOverdueDate: '2026-07-01' },
      'أحمد المعمري',
    ],
    [
      { type: 'owner', id: 'o1', name: 'خالد الشيزاوي', propertyCount: 2, activeContractCount: 2, outstandingAmount: 180.5 },
      'خالد الشيزاوي',
    ],
    [
      { type: 'person', id: 't2', name: 'سالم البلوشي', outstandingAmount: 0 },
      'سالم البلوشي',
    ],
  ];

  it.each(cases)('answers about the focused $0.type from its scoped snapshot', (entity, expectedName) => {
    const result = validate('explain_current_surface', entity);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const output = deterministicResponse(result.value);
    expect(output?.grounded).toBe(true);
    expect(output?.answer).toContain(expectedName);
  });

  it('degrades to the general surface answer when no entity is present', () => {
    const result = validate('explain_current_surface');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const output = deterministicResponse(result.value);
    expect(output?.grounded).toBe(true);
    expect(output?.answer).toMatch(/[\u0600-\u06ff]/);
  });
});

describe('draft safety', () => {
  const draftActions = [
    'draft_tenant_payment_reminder',
    'draft_contract_renewal_followup',
    'draft_maintenance_followup',
    'draft_owner_summary',
    'draft_internal_note',
  ] as const;

  it.each(draftActions)('%s is clearly a draft and never claims to have been sent', (action) => {
    const result = validate(action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Drafts are not deterministic facts; the safe fallback path produces them.
    const output = fallbackResponse(result.value);
    expect(output.grounded).toBe(false);
    const caveats = output.caveats.join(' ');
    expect(caveats).toContain('لم يتم إرسال أي رسالة تلقائياً');
    expect(output.answer).not.toContain('تم الإرسال');
    expect(output.answer).not.toContain('تم التسجيل');
  });
});
