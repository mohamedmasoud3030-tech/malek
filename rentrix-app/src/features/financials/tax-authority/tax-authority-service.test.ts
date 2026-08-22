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

describe('tax authority service — governed boundaries', () => {
  it('uses authoritative RPCs for tax profiles, not raw table writes', () => {
    expect(service).toContain('create_tax_profile_atomic');
    expect(service).toContain('approve_tax_profile_atomic');
    expect(service).toContain('resolve_active_tax_profile');
    expect(service).not.toMatch(/supabase\.from\(['\"]company_tax_profiles['\"]\)\.insert/);
    expect(service).not.toMatch(/supabase\.from\(['\"]company_tax_profiles['\"]\)\.update/);
    expect(service).not.toMatch(/supabase\.from\(['\"]company_tax_profiles['\"]\)\.delete/);
  });

  it('uses authoritative RPCs for fee tax treatments', () => {
    expect(service).toContain('create_fee_tax_treatment_atomic');
    expect(service).toContain('approve_fee_tax_treatment_atomic');
    expect(service).toContain('resolve_active_fee_tax_treatment');
    expect(service).not.toMatch(/supabase\.from\(['\"]company_fee_tax_treatments['\"]\)\.insert/);
  });

  it('never reintroduces company_settings.vat_rate as invoice authority', () => {
    // Service must never read/write legacy VAT fields as authority
    expect(service).not.toMatch(/from\(['\"]company_settings['\"]\)/);
    expect(service).not.toContain('vat_rate');
    expect(service).not.toContain('default_vat_rate');
    expect(readiness).not.toMatch(/from\(['\"]company_settings['\"]\)/);
    // UI may mention legacy field explicitly to say it is NOT used — that's allowed and desired
    expect(workspace).toContain('company_settings.vat_rate');
    expect(workspace).toContain('لا تُحسم');
    expect(readinessSection).toContain('company_settings.vat_rate');
    expect(readinessSection).toContain('لا يُستخدم');
  });

  it('distinguishes rent tax from fee tax clearly', () => {
    expect(service).toContain('company_tax_profiles');
    expect(service).toContain('company_fee_tax_treatments');
    expect(service).toContain('RATE_MANAGEMENT_FEE');
    expect(service).toContain('FIXED_MONTHLY');
    expect(workspace).toContain('ضريبة الإيجار');
    expect(workspace).toContain('معالجات ضريبة أتعاب الإدارة');
    expect(readinessSection).toContain('ضريبة الإيجار');
    expect(readinessSection).toContain('ضريبة أتعاب الإدارة');
  });

  it('preserves versioning, approval, and maker-checker', () => {
    expect(service).toContain('version_no');
    expect(service).toContain('status');
    expect(service).toContain('created_by');
    expect(service).toContain('approved_by');
    expect(workspace).toContain('created_by !== currentUserId');
    expect(workspace).toContain('بانتظار مدقق مختلف');
    expect(workspace).toContain('DRAFT');
    expect(workspace).toContain('ACTIVE');
  });

  it('finance readiness shows READY / MISSING / BLOCKED / DRAFT_NEEDS_APPROVAL', () => {
    expect(readiness).toContain('READY');
    expect(readiness).toContain('MISSING');
    expect(readiness).toContain('BLOCKED');
    expect(readiness).toContain('DRAFT_NEEDS_APPROVAL');
    expect(readinessSection).toContain('READY');
    expect(readinessSection).toContain('MISSING');
    expect(readinessSection).toContain('BLOCKED');
    expect(readinessSection).toContain('DRAFT_NEEDS_APPROVAL');
    expect(readinessSection).toContain('TAX_PROFILE_MISSING');
    expect(readinessSection).toContain('FEE_TAX_TREATMENT_MISSING');
  });

  it('fail-closed behavior for invoicing and accrual', () => {
    expect(readiness).toContain('TAX_PROFILE_MISSING');
    expect(readiness).toContain('FEE_TAX_TREATMENT_MISSING');
    expect(readinessSection).toContain('الفوترة ستفشل مغلقًا');
    expect(readinessSection).toContain('الاستحقاق الشهري سيفشل مغلقًا');
  });

  it('links user to exact corrective action', () => {
    expect(readinessSection).toContain('إنشاء ملف ضريبي');
    expect(readinessSection).toContain('إنشاء معالجة');
    expect(readinessSection).toContain('/settings');
    expect(readinessSection).toContain('finance-readiness');
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
