import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6d — long form mobile steppers (closeout)', () => {
  it('keeps the contract form to three operator steps without hiding billing decisions', () => {
    const source = read('./contracts/components/ContractFormFields.tsx');
    expect(source).toContain('MobileFormStepperHeader');
    expect(source).toContain('MobileFormStepperFooter');
    expect(source).toContain("{ id: 'parties', label: 'العقار والمستأجر' }");
    expect(source).toContain("{ id: 'terms', label: 'المدة والإيجار' }");
    expect(source).toContain("{ id: 'review', label: 'التأكيد' }");
    expect(source).not.toContain("{ id: 'details', label: 'التفاصيل والاتفاقية' }");
    expect(source).toContain("['property_id', 'unit_id', 'tenant_id']");
    expect(source).toContain("['start_date', 'end_date', 'rent_amount', 'payment_cycle', 'billing_day', 'grace_days', 'payment_terms_id']");
    expect(source).toContain('خيارات الفوترة');
    expect(source).toContain('form.register(\'billing_day\')');
    expect(source).toContain('form.register(\'grace_days\')');
  });

  it('keeps lifecycle-only fields out of the visible general contract form', () => {
    const source = read('./contracts/components/ContractFormFields.tsx');
    expect(source).toContain('<input type="hidden" {...form.register(\'status\')} />');
    expect(source).toContain('<input type="hidden" {...form.register(\'cancellation_reason\')} />');
    expect(source).not.toContain('label="الحالة"');
    expect(source).not.toContain('label="سبب الإلغاء"');
  });

  it('preserves state on step changes: sections are hidden on mobile, never unmounted', () => {
    const source = read('./contracts/components/ContractFormFields.tsx');
    expect(source).toContain('max-md:hidden');
    expect(source).toContain('stepVisibility');
  });

  it('returns the user to the step owning a validation error after a failed submit', () => {
    const source = read('./contracts/components/ContractFormFields.tsx');
    expect(source).toContain('stepFieldGroups.findIndex');
    expect(source).toContain('setStep(errorStep)');
    expect(source).toContain('setBillingOptionsOpen(true)');
  });

  it('keeps contract submission semantics unchanged (same schema parse and mutation path)', () => {
    const hook = read('./contracts/useContractForm.ts');
    expect(hook).toContain('contractSchema.parse(values)');
    expect(hook).toContain('createMutation.mutateAsync(finalPayload)');
    expect(hook).toContain('updateMutation.mutateAsync(finalPayload)');
    expect(hook).toContain('const agreementId = agreementCoverageQuery.data?.id ?? null');
  });

  it('gives the owner agreement overlay a mobile stepper over its real domain fields', () => {
    const source = read('./owners/OwnerAgreementsManager.tsx');
    expect(source).toContain('MobileFormStepperHeader');
    expect(source).toContain('MobileFormStepperFooter');
    expect(source).toContain("{ id: 'owner', label: 'المالك والسياق' }");
    expect(source).toContain("{ id: 'scope', label: 'النطاق والشروط المالية' }");
    expect(source).toContain("{ id: 'period', label: 'المدة والملاحظات' }");
    expect(source).toContain("{ id: 'review', label: 'المراجعة والتأكيد' }");
    expect(source).toContain('choose the owner'.length > 0 ? 'اختر المالك الذي تغطي ملكيته الفترة' : 'اختر المالك');
    expect(source).toContain('assertAgreementOwnerHasOwnership(ownershipLinks, payload)');
    expect(source).toContain('createMutation.mutateAsync(payload)');
  });
});