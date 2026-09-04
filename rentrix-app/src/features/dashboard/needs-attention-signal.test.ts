import { describe, expect, it } from 'vitest';
import {
  buildNeedsAttentionSignal,
  EMPTY_NEEDS_ATTENTION_SIGNAL,
  NEEDS_ATTENTION_VACANCY_DAYS,
} from './needs-attention-signal';
import { EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL } from './maintenance-follow-up-signal';
import { EMPTY_UTILITY_OBLIGATIONS_SIGNAL } from './utility-obligations-signal';
import type { DashboardSnapshot } from './dashboard-snapshot';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';

function makeSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    period: { dateFrom: '2026-08-01', dateTo: '2026-08-29', asOf: '2026-08-29', month: 8, year: 2026 },
    portfolio: { properties: 1, units: 4 },
    occupancy: { occupiedUnits: 3, vacantUnits: 1, occupancyRate: 75 },
    contracts: { active: 3 },
    billing: { invoicedAmount: 1000, invoicesTotalCount: 40 },
    collections: { collectedAmount: 800, outstandingAmount: 200, collectionRate: 80 },
    expenses: { totalAmount: 100 },
    netCash: 700,
    arrears: {
      totalOverdue: 200, overdueCount: 1, averageDaysOverdue: 12, over90Count: 0,
      buckets: {
        current: { total: 0, count: 0 },
        days_1_30: { total: 200, count: 1 },
        days_31_60: { total: 0, count: 0 },
        days_61_90: { total: 0, count: 0 },
        days_90_plus: { total: 0, count: 0 },
      },
    },
    ownerFunds: { settlementsDraft: 0, settlementsApproved: 0 },
    maintenance: { urgentOpen: 0 },
    exceptions: { unmatchedBankLines: 0 },
    queues: { expiringContracts: [], overdueInvoices: [] },
    ...overrides,
  };
}

const emptyVacancy: VacancyAnalytics = {
  totalUnits: 4,
  occupiedUnits: 3,
  availableUnits: 1,
  nonRentableUnits: 0,
  occupancyRate: 75,
  vacancyRate: 25,
  averageVacancyDays: 0,
  referenceVacantRent: 0,
  previousMonthOccupancyRate: 75,
  occupancyChangePoints: 0,
  previousMonthEnd: '2026-07-31',
  vacantRows: [],
  vacancyRiskRows: [],
};

describe('buildNeedsAttentionSignal', () => {
  it('returns an empty signal without a snapshot instead of fabricating priorities', () => {
    const signal = buildNeedsAttentionSignal({
      snapshot: undefined,
      vacancyAnalytics: emptyVacancy,
      utilityObligations: EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
      maintenanceFollowUp: EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
    });
    expect(signal).toEqual({ ...EMPTY_NEEDS_ATTENTION_SIGNAL, isComplete: false });
  });

  it('marks a valid partial queue as incomplete when a contributing read failed', () => {
    const signal = buildNeedsAttentionSignal({
      snapshot: makeSnapshot(),
      vacancyAnalytics: emptyVacancy,
      utilityObligations: EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
      maintenanceFollowUp: EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
      isComplete: false,
    });

    expect(signal.isComplete).toBe(false);
    expect(signal.totalCount).toBe(0);
  });

  it('merges real conditions from the authoritative sources into decision items', () => {
    const snapshot = makeSnapshot({
      maintenance: { urgentOpen: 1 },
      queues: {
        overdueInvoices: [{
          invoiceId: 'inv-1', reference: 'INV-1', dueDate: '2026-08-01', daysOverdue: 28,
          remainingAmount: 200, tenantName: 'أحمد', propertyTitle: 'برج أ', unitNumber: '3',
        }],
        expiringContracts: [{
          id: 'con-1', reference: 'CON-1', endDate: '2026-09-05', daysRemaining: 7,
          tenantName: 'سالم', propertyTitle: 'برج أ', unitNumber: '2',
        }],
      },
    });

    const signal = buildNeedsAttentionSignal({
      snapshot,
      vacancyAnalytics: emptyVacancy,
      utilityObligations: EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
      maintenanceFollowUp: EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
    });

    expect(signal.totalCount).toBe(3);
    const overdue = signal.items.find((item) => item.key === 'overdue-inv-1');
    const maintenance = signal.items.find((item) => item.key === 'maintenance-action');
    const expiring = signal.items.find((item) => item.key === 'expiring-con-1');
    expect(overdue?.severity).toBe('danger');
    expect(overdue?.to).toBe('/financials');
    expect(overdue?.search).toEqual({ section: 'collections', view: 'arrears' });
    expect(maintenance?.severity).toBe('danger');
    expect(maintenance?.to).toBe('/maintenance');
    expect(expiring?.severity).toBe('danger');
    expect(expiring?.contractId).toBe('con-1');
  });

  it('keeps urgent maintenance and follow-up as one owner decision instead of duplicate queue rows', () => {
    const signal = buildNeedsAttentionSignal({
      snapshot: makeSnapshot({ maintenance: { urgentOpen: 1 } }),
      vacancyAnalytics: emptyVacancy,
      utilityObligations: EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
      maintenanceFollowUp: {
        stalledCount: 1,
        awaitingClosureCount: 1,
        scheduleMissedCount: 0,
        actionableCount: 2,
        oldestOpenAgeDays: 12,
      },
    });

    const maintenanceItems = signal.items.filter((item) => item.to === '/maintenance');
    expect(maintenanceItems).toHaveLength(1);
    expect(maintenanceItems[0]?.key).toBe('maintenance-action');
    expect(maintenanceItems[0]?.severity).toBe('danger');
    expect(maintenanceItems[0]?.title).toContain('1 طلب صيانة عاجل');
    expect(maintenanceItems[0]?.meta).toContain('2 يحتاج متابعة تشغيلية');
  });

  it('ranks by severity first, then by age inside the severity', () => {
    const snapshot = makeSnapshot({
      queues: {
        overdueInvoices: [
          { invoiceId: 'inv-new', reference: null, dueDate: '2026-08-20', daysOverdue: 9, remainingAmount: 10, tenantName: 'جديد', propertyTitle: null, unitNumber: null },
          { invoiceId: 'inv-old', reference: null, dueDate: '2026-07-01', daysOverdue: 59, remainingAmount: 10, tenantName: 'قديم', propertyTitle: null, unitNumber: null },
        ],
        expiringContracts: [{ id: 'con-2', reference: null, endDate: '2026-09-20', daysRemaining: 22, tenantName: 'عقد', propertyTitle: null, unitNumber: null }],
      },
      exceptions: { unmatchedBankLines: 3 },
    });

    const signal = buildNeedsAttentionSignal({
      snapshot,
      vacancyAnalytics: {
        ...emptyVacancy,
        vacantRows: [{
          unitId: 'unit-9', propertyId: 'property-1', unitNumber: '9', propertyTitle: 'برج أ',
          referenceRent: null, lastContractEndDate: null, vacancySince: '2026-05-01',
          vacancySinceSource: 'unit_created', daysVacant: NEEDS_ATTENTION_VACANCY_DAYS + 5,
        }],
      },
      utilityObligations: EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
      maintenanceFollowUp: EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
    });

    const severities = signal.items.map((item) => item.severity);
    expect(severities).toEqual([...severities].sort((a, b) => {
      const rank = { danger: 0, warning: 1, info: 2 } as const;
      return rank[a] - rank[b];
    }));
    expect(signal.items[0].title).toBe('قديم');
    expect(signal.items.some((item) => item.key === 'vacant-unit-9' && item.severity === 'warning')).toBe(true);
    expect(signal.items.some((item) => item.key === 'bank-reconciliation')).toBe(true);
  });

  it('surfaces owner settlements and utility obligations with the correct workflow routes', () => {
    const snapshot = makeSnapshot({
      ownerFunds: { settlementsDraft: 1, settlementsApproved: 2 },
    });
    const signal = buildNeedsAttentionSignal({
      snapshot,
      vacancyAnalytics: emptyVacancy,
      utilityObligations: {
        summary: {
          overdueCount: 1, overdueAmount: 12, dueSoonCount: 2, dueSoonAmount: 20,
          outstandingCount: 3, outstandingAmount: 32, remainingByResponsibleParty: { tenant: 0, landlord: 32, company: 0 },
        },
        actionableCount: 3,
        oldestOverdueDays: 15,
      },
      maintenanceFollowUp: EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
    });

    const approved = signal.items.find((item) => item.key === 'owner-settlements-approved');
    const draft = signal.items.find((item) => item.key === 'owner-settlements-draft');
    expect(approved?.to).toBe('/financials');
    expect(approved?.search).toEqual({ section: 'funds', view: 'owner_settlements' });
    expect(approved?.severity).toBe('warning');
    expect(draft?.severity).toBe('info');
    expect(signal.items.find((item) => item.key === 'utilities-overdue')?.severity).toBe('danger');
    expect(signal.items.find((item) => item.key === 'utilities-due-soon')?.severity).toBe('warning');
  });

  it('does not invent vacancy items under the aging threshold', () => {
    const signal = buildNeedsAttentionSignal({
      snapshot: makeSnapshot(),
      vacancyAnalytics: {
        ...emptyVacancy,
        vacantRows: [{
          unitId: 'unit-2', propertyId: 'property-1', unitNumber: '2', propertyTitle: 'برج أ',
          referenceRent: null, lastContractEndDate: null, vacancySince: '2026-08-20',
          vacancySinceSource: 'unit_created', daysVacant: NEEDS_ATTENTION_VACANCY_DAYS - 1,
        }],
      },
      utilityObligations: EMPTY_UTILITY_OBLIGATIONS_SIGNAL,
      maintenanceFollowUp: EMPTY_MAINTENANCE_FOLLOW_UP_SIGNAL,
    });
    expect(signal.items.some((item) => item.key.startsWith('vacant-'))).toBe(false);
  });
});
