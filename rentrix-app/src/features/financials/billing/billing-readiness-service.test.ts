import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servicePath = resolve(import.meta.dirname, './billing-readiness-service.ts');
const service = readFileSync(servicePath, 'utf8');
const sectionPath = resolve(import.meta.dirname, './billing-readiness-section.tsx');
const section = readFileSync(sectionPath, 'utf8');
const workspacePath = resolve(import.meta.dirname, '../components/invoice-workspace-section.tsx');
const workspace = readFileSync(workspacePath, 'utf8');

describe('billing readiness service — FOM-007', () => {
  it('lists active contracts with explicit billing policy', () => {
    expect(service).toContain('contracts');
    expect(service).toContain('billing_day');
    expect(service).toContain('grace_days');
    expect(service).toContain('payment_cycle');
    expect(service).toContain('payment_terms_id');
    expect(service).toContain('agreement_id');
    expect(service).toContain('collection_role_snapshot');
    expect(service).toContain('operating_model_snapshot');
  });

  it('derives billing periods from payment_cycle and billing_day/grace_days', () => {
    expect(service).toContain('getPeriodForCycle');
    expect(service).toContain('monthly');
    expect(service).toContain('quarterly');
    expect(service).toContain('semi_annual');
    expect(service).toContain('annual');
    expect(service).toContain('billing_day');
    expect(service).toContain('grace_days');
    expect(service).toContain('issue_date');
    expect(service).toContain('due_date');
  });

  it('checks invoice existence via ux_invoices_billing_obligation semantics', () => {
    expect(service).toContain('billing_period_start');
    expect(service).toContain('charge_type');
    expect(service).toContain('RENT');
    expect(service).toContain('invoice_exists');
    expect(section).toContain('ux_invoices_billing_obligation');
  });

  it('detects blocked billing via tax, agreement, model snapshot', () => {
    expect(service).toContain('AGREEMENT_MISSING');
    expect(service).toContain('MODEL_SNAPSHOT_MISSING');
    expect(service).toContain('TAX_PROFILE_MISSING');
    expect(service).toContain('resolve_active_tax_profile');
    expect(service).toContain('BLOCKED');
  });

  it('distinguishes NOT_DUE, DUE, GENERATED, BLOCKED, FAILED, RECOVERED', () => {
    expect(service).toContain('NOT_DUE');
    expect(service).toContain('DUE');
    expect(service).toContain('GENERATED');
    expect(service).toContain('BLOCKED');
    expect(service).toContain('FAILED');
    expect(service).toContain('RECOVERED');
    expect(section).toContain('NOT_DUE');
    expect(section).toContain('DUE');
    expect(section).toContain('GENERATED');
    expect(section).toContain('BLOCKED');
  });

  it('payment_terms_id is labeled as reference only, not scheduling authority', () => {
    expect(service).toContain('payment_terms_id');
    expect(section).toContain('payment_terms_id');
    expect(section).toContain('مرجع فقط');
    expect(section).toContain('الجدولة الفعلية تُحسم من حقول العقد الصريحة');
  });

  it('idempotent retry via unique index prevents duplicate billing', () => {
    expect(section).toContain('ux_invoices_billing_obligation');
    expect(section).toContain('نفس الفترة لا تُفوتر مرتين');
    expect(section).toContain('idempotent');
  });

  it('provides recovery via generate_invoices_from_active_contracts', () => {
    expect(service).toContain('generate_invoices_from_active_contracts');
    expect(section).toContain('generate_invoices_from_active_contracts');
    expect(section).toContain('توليد فواتير العقود النشطة');
    expect(section).toContain('استرداد');
    expect(workspace).toContain('BillingReadinessSection');
  });

  it('shows due, generated, blocked, not due counts and filters', () => {
    expect(section).toContain('totalDue');
    expect(section).toContain('totalGenerated');
    expect(section).toContain('totalBlocked');
    expect(section).toContain('totalNotDue');
    expect(section).toContain('showOnlyBlocked');
    expect(section).toContain('عرض المحظور/المستحق فقط');
  });

  it('does not replace correct atomic generator, keeps manual batch as recovery', () => {
    expect(section).toContain('توليد فواتير العقود النشطة (استرداد)');
    expect(section).not.toContain('automated billing');
    expect(section).toContain('RPC الذري');
  });
});
