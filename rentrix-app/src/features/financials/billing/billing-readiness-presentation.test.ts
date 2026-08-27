import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  billingActionErrorMessage,
  billingIssueMessage,
  billingStatusLabel,
  paymentCycleLabel,
} from './billing-readiness-presentation';

const sectionSource = readFileSync(new URL('./billing-readiness-section.tsx', import.meta.url), 'utf8');

describe('billing readiness presentation', () => {
  it('maps backend reasons to clear Arabic actions without leaking raw diagnostics', () => {
    expect(billingIssueMessage('AGREEMENT_MISSING: detail', 'BLOCKED')).toBe('أضف اتفاقية إدارة للعقد قبل إصدار الفاتورة.');
    expect(billingIssueMessage('MODEL_SNAPSHOT_MISSING: detail', 'BLOCKED')).toBe('أكمل إعداد نموذج تشغيل العقد قبل إصدار الفاتورة.');
    expect(billingIssueMessage('TAX_PROFILE_MISSING: detail', 'BLOCKED')).toBe('لا يوجد ملف ضريبي ساري يغطي تاريخ الفاتورة.');
    expect(billingIssueMessage('TAX_CHECK_FAILED: permission denied for function resolve_active_tax_profile', 'CHECK_FAILED')).toContain('تعذر التحقق من الإعداد الضريبي');
    expect(billingIssueMessage('SOME_INTERNAL_CODE: private detail', 'BLOCKED')).toBe('يحتاج العقد إلى مراجعة قبل إصدار الفاتورة.');
  });

  it('keeps concise user-facing status and cycle labels', () => {
    expect(billingStatusLabel('DUE')).toBe('جاهز للفوترة');
    expect(billingStatusLabel('CHECK_FAILED')).toBe('تعذر التحقق');
    expect(paymentCycleLabel('monthly')).toBe('شهري');
    expect(paymentCycleLabel('annual')).toBe('سنوي');
  });

  it('does not surface raw mutation errors', () => {
    expect(billingActionErrorMessage(new Error('permission denied for function resolve_active_tax_profile'))).toBe('تعذر التحقق من إعدادات الفوترة. راجع الصلاحيات أو أعد المحاولة.');
    expect(billingActionErrorMessage(new Error('internal network stack trace'))).not.toContain('stack');
  });

  it('keeps implementation documentation out of the production readiness card', () => {
    expect(sectionSource).not.toContain('<code>');
    expect(sectionSource).not.toContain('ux_invoices_billing_obligation');
    expect(sectionSource).not.toContain('كيف يعمل الاسترداد المتكرر والتحقق الفاشل؟');
    expect(sectionSource).not.toContain('{o.blocked_reason}');
    expect(sectionSource).not.toContain('(استرداد)');
    expect(sectionSource).toContain('توليد الفواتير الجاهزة');
    expect(sectionSource).toContain('data-billing-readiness');
  });
});
