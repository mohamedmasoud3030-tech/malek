import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const servicePath = resolve(import.meta.dirname, './tax-authority-service.ts');
const service = readFileSync(servicePath, 'utf8');
const readinessPath = resolve(import.meta.dirname, './finance-readiness-service.ts');
const readiness = readFileSync(readinessPath, 'utf8');
const workspacePath = resolve(import.meta.dirname, './tax-profile-workspace.tsx');
const workspace = readFileSync(workspacePath, 'utf8');
const readinessSectionPath = resolve(import.meta.dirname, './finance-readiness-section.tsx');
const readinessSection = readFileSync(readinessSectionPath, 'utf8');
const boundaryPath = resolve(import.meta.dirname, './tax-readiness-boundary.ts');
const boundary = readFileSync(boundaryPath, 'utf8');

describe('tax authority service — governed boundaries', () => {
  it('uses authoritative RPCs for tax profile commands, not raw table writes', () => {
    expect(service).toContain('create_tax_profile_atomic');
    expect(service).toContain('approve_tax_profile_atomic');
    expect(service).not.toMatch(/supabase\.from\(['\"]company_tax_profiles['\"]\)\.insert/);
    expect(service).not.toMatch(/supabase\.from\(['\"]company_tax_profiles['\"]\)\.update/);
    expect(service).not.toMatch(/supabase\.from\(['\"]company_tax_profiles['\"]\)\.delete/);
  });

  it('uses authoritative RPCs for fee tax treatment commands', () => {
    expect(service).toContain('create_fee_tax_treatment_atomic');
    expect(service).toContain('approve_fee_tax_treatment_atomic');
    expect(service).not.toMatch(/supabase\.from\(['\"]company_fee_tax_treatments['\"]\)\.insert/);
  });

  it('never calls the service_role-only tax resolvers from the browser', () => {
    // resolve_active_tax_profile / resolve_active_fee_tax_treatment are internal
    // helpers (migration 20260901000020 revoked browser EXECUTE and aborts if it
    // is re-opened). The dead getActiveTaxProfile / getActiveTaxProfileForCompany
    // / getActiveFeeTaxTreatment helpers were removed; tax readiness now flows
    // through the single governed boundary module.
    for (const source of [service, readiness, boundary]) {
      expect(source).not.toMatch(/rpc\(\s*'resolve_active_tax_profile'/);
      expect(source).not.toMatch(/rpc\(\s*'resolve_active_fee_tax_treatment'/);
    }
    expect(service).not.toContain('getActiveTaxProfile');
    expect(service).not.toContain('getActiveFeeTaxTreatment');
    expect(boundary).toContain("rpc('resolve_tax_authority_readiness'");
    // The governed boundary takes dates only: company scope is derived from the
    // authenticated caller, never accepted as an argument.
    expect(boundary).not.toMatch(/p_company_id\s*:/);
    expect(readiness).toContain('resolveTaxAuthorityReadiness');
  });

  it('never reintroduces company_settings.vat_rate as invoice authority', () => {
    // Service must never read/write legacy VAT fields as authority
    expect(service).not.toMatch(/from\(['\"]company_settings['\"]\)/);
    expect(service).not.toContain('vat_rate');
    expect(service).not.toContain('default_vat_rate');
    expect(readiness).not.toMatch(/from\(['\"]company_settings['\"]\)/);
    // The operator surfaces no longer reference the retired legacy field at
    // all — the tax authority model is the only visible source.
    expect(workspace).not.toContain('company_settings.vat_rate');
    expect(readinessSection).not.toContain('company_settings.vat_rate');
    expect(readinessSection).not.toContain('vat_rate');
  });

  it('distinguishes rent tax from fee tax clearly', () => {
    expect(service).toContain('company_tax_profiles');
    expect(service).toContain('company_fee_tax_treatments');
    expect(service).toContain('RATE_MANAGEMENT_FEE');
    expect(service).toContain('FIXED_MONTHLY');
    expect(workspace).toContain('ضريبة الإيجار');
    expect(workspace).toContain('ضريبة أتعاب الإدارة');
    expect(readinessSection).toContain('ضريبة الإيجار');
    expect(readinessSection).toContain('ضريبة أتعاب الإدارة');
    // Rate vs fixed monthly fee treatments stay distinguishable.
    expect(workspace).toContain('RATE_MANAGEMENT_FEE');
  });

  it('preserves versioning, approval, and maker-checker', () => {
    expect(service).toContain('version_no');
    expect(service).toContain('status');
    expect(service).toContain('created_by');
    expect(service).toContain('approved_by');
    expect(workspace).toContain('created_by !== currentUserId');
    // Maker-checker copy is operator-phrased: a draft waits for another
    // authorized user's approval instead of exposing checker terminology.
    expect(workspace).toContain('ينتظر اعتماد مستخدم آخر');
    expect(workspace).toContain('DRAFT');
    expect(workspace).toContain('ACTIVE');
  });

  it('finance readiness shows READY / MISSING / BLOCKED / DRAFT_NEEDS_APPROVAL', () => {
    expect(readiness).toContain('READY');
    expect(readiness).toContain('MISSING');
    expect(readiness).toContain('BLOCKED');
    expect(readiness).toContain('DRAFT_NEEDS_APPROVAL');
    // Every state maps to tone + operator label + corrective message.
    expect(readinessSection).toContain("if (state === 'READY') return 'success'");
    expect(readinessSection).toContain("if (state === 'MISSING') return 'danger'");
    expect(readinessSection).toContain("if (state === 'DRAFT_NEEDS_APPROVAL') return 'warning'");
    expect(readinessSection).toContain('labelForState(state)');
    expect(readinessSection).toContain('readinessMessage(state, missingMessage)');
    // Domain-specific corrective copy stays per-card, not raw reason codes.
    expect(readinessSection).toContain('أكمل إعداد ضريبة الإيجار قبل إصدار الفواتير.');
    expect(readinessSection).toContain('أكمل إعداد ضريبة أتعاب الإدارة قبل تسجيل التحصيل المرتبط بها.');
  });

  it('fail-closed behavior for invoicing and accrual', () => {
    expect(readiness).toContain('TAX_PROFILE_MISSING');
    expect(readiness).toContain('FEE_TAX_TREATMENT_MISSING');
    // Fail-closed semantics in operator copy: invoicing/collection cannot run
    // until the corresponding tax setup completes.
    expect(readinessSection).toContain('أكمل إعداد ضريبة الإيجار قبل إصدار الفواتير.');
    expect(readinessSection).toContain('أكمل إعداد ضريبة الأتعاب الشهرية قبل تسجيل الاستحقاق.');
    // The readiness service still blocks, not guesses, when checks fail.
    expect(readiness).toContain("'BLOCKED'");
  });

  it('links user to exact corrective action', () => {
    // Non-ready tax cards deep-link to the canonical settings surface where
    // the tax profiles/treatments workspace lives.
    expect(readinessSection).toContain("to=\"/settings\"");
    expect(readinessSection).toContain("companySection: 'finance-readiness'");
    expect(readinessSection).toContain('فتح إعدادات الضريبة');
    // Accounting readiness keeps its canonical Reports deep link.
    expect(readinessSection).toContain("search={{ section: 'accounting' } as never}");
  });

  it('uses company-scoped, governed, audited boundaries', () => {
    expect(service).toContain('company_id');
    expect(service).toContain('request_id');
    expect(service).toContain('crypto.randomUUID()');
    expect(readiness).toContain('companyId');
    expect(service).toContain('company_tax_profiles');
    expect(service).toContain('company_fee_tax_treatments');
  });
});
