import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servicePath = resolve(import.meta.dirname, './billing-readiness-service.ts');
const service = readFileSync(servicePath, 'utf8');
const schedulePath = resolve(import.meta.dirname, './billing-schedule.ts');
const schedule = readFileSync(schedulePath, 'utf8');
const sectionPath = resolve(import.meta.dirname, './billing-readiness-section.tsx');
const section = readFileSync(sectionPath, 'utf8');
const workspacePath = resolve(import.meta.dirname, '../components/invoice-workspace-section.tsx');
const workspace = readFileSync(workspacePath, 'utf8');

describe('billing readiness service — FOM-007 remediation', () => {
  it('lists active contracts with explicit billing policy via pagination contract', () => {
    expect(service).toContain('contracts');
    expect(service).toContain('billing_day');
    expect(service).toContain('grace_days');
    expect(service).toContain('payment_cycle');
    expect(service).toContain('payment_terms_id');
    expect(service).toContain('agreement_id');
    expect(service).toContain('fetchAllRows'); // no silent .limit(200)
    expect(service).not.toContain('.limit(200)'); // Defect A5 fixed
  });

  it('uses single authoritative schedule algorithm from billing-schedule.ts', () => {
    expect(service).toContain('getBillingPeriodForCycle');
    expect(service).toContain('getIssueDate');
    expect(service).toContain('getDueDate');
    expect(service).toContain('deriveBillingStatus');
    expect(schedule).toContain('getBillingPeriodForCycle');
    expect(schedule).toContain('monthly');
    expect(schedule).toContain('quarterly');
    expect(schedule).toContain('semi_annual');
    expect(schedule).toContain('annual');
  });

  it('truthful NOT_DUE logic: before billing day → NOT_DUE, on/after → DUE if absent', () => {
    expect(schedule).toContain('today < issueDate');
    expect(schedule).toContain('NOT_DUE');
    expect(schedule).toContain('DUE');
    expect(schedule).toContain('GENERATED');
    expect(schedule).toContain('BLOCKED');
    expect(section).toContain('غير مستحق بعد (قبل يوم الفوترة)');
    // Old buggy logic period.start > today should not exist
    expect(service).not.toContain('period.start > today');
  });

  it('checks invoice existence via billing_period_start and ux_invoices_billing_obligation', () => {
    expect(service).toContain('billing_period_start');
    expect(service).toContain('charge_type');
    expect(service).toContain('RENT');
    expect(service).toContain('invoice_exists');
    expect(section).toContain('ux_invoices_billing_obligation');
    expect(section).toContain('نفس الفترة لا تُفوتر مرتين');
  });

  it('detects blocked billing via agreement, model snapshot, tax missing', () => {
    expect(schedule).toContain('AGREEMENT_MISSING');
    expect(schedule).toContain('MODEL_SNAPSHOT_MISSING');
    expect(service).toContain('TAX_PROFILE_MISSING');
    expect(service).toContain('resolve_active_tax_profile');
    expect(service).toContain('BLOCKED');
  });

  it('tax check fails closed with CHECK_FAILED, never READY on error (Defect A3)', () => {
    expect(service).toContain('CHECK_FAILED');
    expect(service).toContain('TAX_CHECK_FAILED');
    expect(schedule).toContain('CHECK_FAILED');
    expect(schedule).toContain('taxCheckFailed');
    expect(section).toContain('CHECK_FAILED');
    expect(section).toContain('فشل التحقق');
  });

  it('company identity uses canonical authority, not arbitrary company_settings limit 1 (Defect A4)', () => {
    expect(service).toContain('companyId');
    expect(service).toContain('getBillingReadiness(companyId');
    expect(service).not.toContain("from('company_settings').select('company_id').limit(1)");
    expect(section).toContain('useActiveCompanyId');
    expect(section).toContain("queryKey: ['billing-readiness', companyId]");
  });

  it('FAILED and RECOVERED removed — no authoritative history today (Defect A2)', () => {
    expect(service).not.toContain("'FAILED'");
    expect(service).not.toContain("'RECOVERED'");
    expect(service).not.toContain('"FAILED"');
    expect(service).not.toContain('"RECOVERED"');
    expect(schedule).toContain("export type BillingStatus = 'NOT_DUE' | 'DUE' | 'GENERATED' | 'BLOCKED' | 'CHECK_FAILED'");
    expect(schedule).not.toContain("| 'FAILED'");
    expect(schedule).not.toContain('| \"FAILED\"');
    expect(section).toContain('FAILED/RECOVERED أُزيلت');
    expect(section).toContain('سجل تاريخي محكوم للفشل');
  });

  it('payment_terms_id is reference only, not scheduling authority', () => {
    expect(service).toContain('payment_terms_id');
    expect(section).toContain('payment_terms_id');
    expect(section).toContain('مرجع فقط');
    expect(section).toContain('الجدولة الفعلية تُحسم من حقول العقد الصريحة');
  });

  it('provides recovery via generate_invoices_from_active_contracts idempotent', () => {
    expect(service).toContain('generate_invoices_from_active_contracts');
    expect(section).toContain('generate_invoices_from_active_contracts');
    expect(section).toContain('توليد فواتير العقود النشطة');
    expect(section).toContain('استرداد');
    expect(workspace).toContain('BillingReadinessSection');
  });

  it('shows due, generated, blocked, not due, check_failed counts and filters', () => {
    expect(section).toContain('totalDue');
    expect(section).toContain('totalGenerated');
    expect(section).toContain('totalBlocked');
    expect(section).toContain('totalNotDue');
    expect(section).toContain('totalCheckFailed');
    expect(section).toContain('showOnlyBlocked');
  });
});
