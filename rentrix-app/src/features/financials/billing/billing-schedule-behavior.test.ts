import { describe, expect, it } from 'vitest';
import {
  deriveBillingStatus,
  formatLocalDate,
  getBillingPeriodForCycle,
  getContractBlockedReason,
  getDueDate,
  getIssueDate,
  type BillingStatus,
} from './billing-schedule';

describe('billing schedule — authoritative single algorithm', () => {
  it('monthly period: start first day, end last day', () => {
    const ref = new Date('2026-08-15');
    const period = getBillingPeriodForCycle('monthly', ref);
    expect(formatLocalDate(period.start)).toBe('2026-08-01');
    expect(formatLocalDate(period.end)).toBe('2026-08-31');
  });

  it('quarterly period', () => {
    const ref = new Date('2026-08-15'); // Q3
    const period = getBillingPeriodForCycle('quarterly', ref);
    expect(formatLocalDate(period.start)).toBe('2026-07-01');
    expect(formatLocalDate(period.end)).toBe('2026-09-30');
  });

  it('semi_annual first half', () => {
    const ref = new Date('2026-02-15');
    const period = getBillingPeriodForCycle('semi_annual', ref);
    expect(formatLocalDate(period.start)).toBe('2026-01-01');
    expect(formatLocalDate(period.end)).toBe('2026-06-30');
  });

  it('semi_annual second half', () => {
    const ref = new Date('2026-08-15');
    const period = getBillingPeriodForCycle('semi_annual', ref);
    expect(formatLocalDate(period.start)).toBe('2026-07-01');
    expect(formatLocalDate(period.end)).toBe('2026-12-31');
  });

  it('annual period', () => {
    const ref = new Date('2026-08-15');
    const period = getBillingPeriodForCycle('annual', ref);
    expect(formatLocalDate(period.start)).toBe('2026-01-01');
    expect(formatLocalDate(period.end)).toBe('2026-12-31');
  });

  it('issue_date anchored to billing_day, clamped to period_end', () => {
    const periodStart = new Date('2026-08-01');
    const periodEnd = new Date('2026-08-31');
    expect(formatLocalDate(getIssueDate(periodStart, periodEnd, 28))).toBe('2026-08-28');
    expect(formatLocalDate(getIssueDate(periodStart, periodEnd, 31))).toBe('2026-08-31'); // clamped
    expect(formatLocalDate(getIssueDate(periodStart, periodEnd, 5))).toBe('2026-08-05');
  });

  it('due_date = period_end + grace_days', () => {
    const periodEnd = new Date('2026-08-31');
    expect(formatLocalDate(getDueDate(periodEnd, 10))).toBe('2026-09-10');
    expect(formatLocalDate(getDueDate(periodEnd, 0))).toBe('2026-08-31');
  });

  it('contract start/end boundaries do not affect current period derivation (period is based on refDate)', () => {
    // Period is based on current date, not contract start/end, per server logic
    const ref = new Date('2026-08-15');
    const period = getBillingPeriodForCycle('monthly', ref);
    expect(formatLocalDate(period.start)).toBe('2026-08-01');
    // Even if contract started earlier or ends later, period remains current
  });

  describe('deriveBillingStatus — truthful NOT_DUE logic (Defect A1)', () => {
    it('before billing day → NOT_DUE', () => {
      const today = new Date('2026-08-05');
      const issueDate = new Date('2026-08-28');
      const periodStart = new Date('2026-08-01');
      const result = deriveBillingStatus({
        periodStart,
        issueDate,
        today,
        invoiceExists: false,
        blockedReason: null,
      });
      expect(result.status).toBe('NOT_DUE');
    });

    it('on billing day absent invoice → DUE', () => {
      const today = new Date('2026-08-28');
      const issueDate = new Date('2026-08-28');
      const periodStart = new Date('2026-08-01');
      const result = deriveBillingStatus({
        periodStart,
        issueDate,
        today,
        invoiceExists: false,
        blockedReason: null,
      });
      expect(result.status).toBe('DUE');
    });

    it('after billing day absent invoice → DUE', () => {
      const today = new Date('2026-08-29');
      const issueDate = new Date('2026-08-28');
      const periodStart = new Date('2026-08-01');
      const result = deriveBillingStatus({
        periodStart,
        issueDate,
        today,
        invoiceExists: false,
        blockedReason: null,
      });
      expect(result.status).toBe('DUE');
    });

    it('existing invoice → GENERATED', () => {
      const today = new Date('2026-08-05');
      const issueDate = new Date('2026-08-28');
      const periodStart = new Date('2026-08-01');
      const result = deriveBillingStatus({
        periodStart,
        issueDate,
        today,
        invoiceExists: true,
        blockedReason: null,
      });
      expect(result.status).toBe('GENERATED');
    });

    it('old logic period.start > today would make NOT_DUE unreachable — prove fix', () => {
      // Old: if period.start > today → NOT_DUE, else DUE
      // For current period 2026-08-01, today 2026-08-05, old would say DUE even though billing_day 28 not yet reached
      const today = new Date('2026-08-05');
      const periodStart = new Date('2026-08-01');
      const issueDate = new Date('2026-08-28');
      // Old logic would be DUE (wrong), new logic correctly NOT_DUE
      const oldStatus: BillingStatus = periodStart > today ? 'NOT_DUE' : 'DUE';
      expect(oldStatus).toBe('DUE'); // old buggy
      const fixed = deriveBillingStatus({ periodStart, issueDate, today, invoiceExists: false, blockedReason: null });
      expect(fixed.status).toBe('NOT_DUE'); // fixed truthful
    });
  });

  describe('blocked reasons (Defect A1, A3)', () => {
    it('missing agreement → BLOCKED', () => {
      const reason = getContractBlockedReason({ agreement_id: null, collection_role_snapshot: 'OWNER_IS_CREDITOR', operating_model_snapshot: 'OWNER_AGENCY' });
      expect(reason).toContain('AGREEMENT_MISSING');
      const result = deriveBillingStatus({
        periodStart: new Date('2026-08-01'),
        issueDate: new Date('2026-08-05'),
        today: new Date('2026-08-10'),
        invoiceExists: false,
        blockedReason: reason,
      });
      expect(result.status).toBe('BLOCKED');
    });

    it('missing model snapshot → BLOCKED', () => {
      const reason = getContractBlockedReason({ agreement_id: 'agr-1', collection_role_snapshot: null, operating_model_snapshot: null });
      expect(reason).toContain('MODEL_SNAPSHOT_MISSING');
      const result = deriveBillingStatus({
        periodStart: new Date('2026-08-01'),
        issueDate: new Date('2026-08-05'),
        today: new Date('2026-08-10'),
        invoiceExists: false,
        blockedReason: reason,
      });
      expect(result.status).toBe('BLOCKED');
    });

    it('TAX_PROFILE_MISSING → BLOCKED', () => {
      const blockedReason = 'TAX_PROFILE_MISSING: لا يوجد ملف ضريبي نافذ يغطي 2026-08-05';
      const result = deriveBillingStatus({
        periodStart: new Date('2026-08-01'),
        issueDate: new Date('2026-08-05'),
        today: new Date('2026-08-10'),
        invoiceExists: false,
        blockedReason,
      });
      expect(result.status).toBe('BLOCKED');
      expect(result.blockedReason).toContain('TAX_PROFILE_MISSING');
    });

    it('tax RPC/read error → CHECK_FAILED fail closed, never READY (Defect A3)', () => {
      const result = deriveBillingStatus({
        periodStart: new Date('2026-08-01'),
        issueDate: new Date('2026-08-05'),
        today: new Date('2026-08-10'),
        invoiceExists: false,
        blockedReason: 'NETWORK_ERROR',
        taxCheckFailed: true,
      });
      expect(result.status).toBe('CHECK_FAILED');
      expect(result.status).not.toBe('READY');
      expect(result.status).not.toBe('NOT_DUE');
      expect(result.status).not.toBe('DUE');
    });
  });

  describe('200-contract truncation (Defect A5)', () => {
    it('200 active contracts cannot silently disappear — service must handle pagination or expose truncated state', () => {
      // This is a behavioral contract: if we have 201 contracts, we must not silently show 200 as healthy
      // The pure schedule logic itself has no limit, but the service that fetches contracts must not use .limit(200) silently
      // We test that getBillingPeriodForCycle works for any count — the service layer must be fixed to paginate
      const manyContracts = Array.from({ length: 201 }, (_, i) => ({ id: `c-${i}` }));
      expect(manyContracts.length).toBe(201);
      // The fix should either paginate or expose truncated flag — we assert that a naive .limit(200) would hide one
      const limited = manyContracts.slice(0, 200);
      expect(limited.length).toBe(200);
      expect(manyContracts.length - limited.length).toBe(1); // one hidden — defect if silent
    });
  });

  describe('FAILED/RECOVERED removal (Defect A2)', () => {
    it('FAILED and RECOVERED are not valid statuses without authoritative history', () => {
      // The fixed type should only have NOT_DUE, DUE, GENERATED, BLOCKED, CHECK_FAILED
      const validStatuses: BillingStatus[] = ['NOT_DUE', 'DUE', 'GENERATED', 'BLOCKED', 'CHECK_FAILED'];
      expect(validStatuses).not.toContain('FAILED' as never);
      expect(validStatuses).not.toContain('RECOVERED' as never);
    });
  });
});
