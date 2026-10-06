import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
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

  it('keeps implementation documentation out of the production readiness card', () => {
    expect(sectionSource).not.toContain('<code>');
    expect(sectionSource).not.toContain('ux_invoices_billing_obligation');
    expect(sectionSource).not.toContain('كيف يعمل الاسترداد المتكرر والتحقق الفاشل؟');
    expect(sectionSource).not.toContain('{o.blocked_reason}');
    expect(sectionSource).not.toContain('(استرداد)');
    expect(sectionSource).toContain('data-billing-readiness');
  });

  it('keeps the obligation register collapsed until the operator asks for it', () => {
    expect(sectionSource).toContain("const [showDetails, setShowDetails] = useState(false)");
    expect(sectionSource).toContain("data-billing-details={showDetails ? 'open' : 'closed'}");
    expect(sectionSource).toContain("{showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}");
    expect(sectionSource).toContain("(showDetails || status !== 'ready')");
    expect(sectionSource).not.toContain('generateInvoicesFromActiveContracts');
  });
});
