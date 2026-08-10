import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6d — long form mobile steppers (closeout)', () => {
  it('gives the contract form a 4-step mobile stepper with progress header and next/back footer', () => {
    const source = read('./contracts/components/ContractFormFields.tsx');
    expect(source).toContain('MobileFormStepperHeader');
    expect(source).toContain('MobileFormStepperFooter');
    expect(source).toContain("{ id: 'parties', label: 'الأطراف والعقار' }");
    expect(source).toContain("{ id: 'period', label: 'المدة والمالية' }");
    expect(source).toContain("{ id: 'details', label: 'التفاصيل والاتفاقية' }");
    expect(source).toContain("{ id: 'review', label: 'المراجعة والتأكيد' }");
    // Steps keep the real field grouping.
    expect(source).toContain("['property_id', 'unit_id', 'tenant_id', 'status']");
    expect(source).toContain("['start_date', 'end_date', 'rent_amount', 'payment_cycle', 'payment_terms_id']");
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
    // Step validation stays near its fields and the final submit still routes
    // through the existing ownership + mutation flow.
    expect(source).toContain('choose the owner'.length > 0 ? 'اختر المالك الذي تغطي ملكيته الفترة' : 'اختر المالك');
    expect(source).toContain('assertAgreementOwnerHasOwnership(ownershipLinks, payload)');
    expect(source).toContain('createMutation.mutateAsync(payload)');
  });
});
