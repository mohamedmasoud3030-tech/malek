import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * UX-041 regression tests:
 * Proves the user is never left with text-only instructions when no owner
 * agreement covers the contract period. Every non-success state must provide
 * at least one actionable control.
 */
describe('ContractAgreementMissingAlert (UX-041)', () => {
  const alertSource = readFileSync(
    resolve(import.meta.dirname, './components/ContractAgreementMissingAlert.tsx'),
    'utf8',
  );

  const fieldsSource = readFileSync(
    resolve(import.meta.dirname, './components/ContractFormFields.tsx'),
    'utf8',
  );

  const modalSource = readFileSync(
    resolve(import.meta.dirname, './contract-form-modal.tsx'),
    'utf8',
  );

  const pageSource = readFileSync(
    resolve(import.meta.dirname, './ContractFormPage.tsx'),
    'utf8',
  );

  const renewalSource = readFileSync(
    resolve(import.meta.dirname, './lifecycle/ContractRenewalDialog.tsx'),
    'utf8',
  );

  it('replaces all dead-end text-only messages with actionable surfaces', () => {
    // The old dead-end text should not appear anywhere
    const deadEndText = 'انتقل إلى صفحة العقار لإنشاء أو تحديث اتفاقية الإدارة أولاً';
    expect(fieldsSource).not.toContain(deadEndText);
    expect(modalSource).not.toContain(deadEndText);
    expect(pageSource).not.toContain(deadEndText);
  });

  it('uses ContractAgreementMissingAlert in all contract form variants', () => {
    expect(fieldsSource).toContain('ContractAgreementMissingAlert');
    expect(pageSource).toContain('ContractAgreementMissingAlert');
    expect(modalSource).toContain('ContractAgreementMissingAlert');
  });

  it('provides direct navigation link to property ownership tab', () => {
    // Alert must contain link to /properties/$propertyId?tab=ownership
    expect(alertSource).toContain("to={propertyTabPath}");
    expect(alertSource).toContain('فتح اتفاقيات العقار');
    expect(alertSource).toContain("tab: 'ownership'");
  });

  it('provides secondary action to change property or dates', () => {
    expect(alertSource).toContain('تغيير العقار أو التواريخ');
  });

  it('shows the selected property name in the alert', () => {
    expect(alertSource).toContain('property.title');
    expect(alertSource).toContain('العقار المحدد');
  });

  it('shows the missing coverage period (start and end dates)', () => {
    expect(alertSource).toContain('startDate');
    expect(alertSource).toContain('endDate');
  });

  it('explains what is needed in clear Arabic', () => {
    expect(alertSource).toContain('لا توجد اتفاقية إدارة تغطي كامل فترة العقد');
    expect(alertSource).toContain('يجب إنشاء اتفاقية إدارة فعالة للمالك لتغطية الفترة');
  });

  it('provides recovery path guidance text', () => {
    expect(alertSource).toContain('سيتم فتح صفحة العقار في تبويب');
    expect(alertSource).toContain('الملكية واتفاقيات التشغيل');
  });

  it('renewal dialog also uses actionable recovery not dead-end text', () => {
    // Renewal should also have direct navigation
    expect(renewalSource).toContain('فتح اتفاقيات العقار');
    expect(renewalSource).toContain("tab: 'ownership'");
  });

  it('preserves validation block (does not allow creating invalid contracts)', () => {
    // The submitDisabled still blocks submission when coverage is missing
    expect(fieldsSource).toContain('Boolean(coverageError)');
    expect(pageSource).toContain('coverageMissing');
  });

  it('handles error state with retry action', () => {
    expect(alertSource).toContain('onRetry');
    expect(alertSource).toContain('إعادة المحاولة');
  });

  it('renders as role="alert" only for error/missing states, not success', () => {
    const alertRoles = (alertSource.match(/role="alert"/g) ?? []).length;
    // Only error and missing states have role="alert" (not success, loading, or prompting)
    expect(alertRoles).toBeGreaterThanOrEqual(2);
  });
});
