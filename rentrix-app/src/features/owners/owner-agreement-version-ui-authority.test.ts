import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manager = readFileSync(new URL('./OwnerAgreementsManager.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('./ownerAgreementService.ts', import.meta.url), 'utf8');
const propertyForm = readFileSync(new URL('../properties/property-form-modal.tsx', import.meta.url), 'utf8');

describe('GAP-004 owner-agreement version authority', () => {
  it('uses atomic identity plus first-version boundaries for both creation journeys', () => {
    expect(service).toContain("rpc('create_owner_agreement_with_version_atomic'");
    expect(service).toContain("rpc('create_property_with_versioned_agreement_atomic'");
  });

  it('keeps amendment history without exposing internal version numbering', () => {
    expect(manager).toContain('سجل التعديلات');
    expect(manager).toContain('تعديل الشروط');
    expect(manager).not.toContain('version.version_no');
    expect(manager).toContain('useCreateOwnerAgreementVersion');
    expect(service).toContain("rpc('create_future_owner_agreement_version_atomic'");
  });

  it('keeps specialist settlement and deposit choices available without crowding the default amendment form', () => {
    expect(manager).toContain('خيارات التسوية والتأمين');
    expect(manager).toContain('versionForm.offset_allowed');
    expect(manager).toContain('versionForm.reserve_amount');
    expect(manager).toContain('versionForm.deposit_beneficiary');
    expect(manager).toContain('versionForm.deposit_custodian');
  });

  it('routes save failures through the user-facing Arabic error mapper', () => {
    expect(manager).toContain('getActionableSupabaseErrorMessage');
    expect(manager).not.toContain("error instanceof Error ? error.message : 'تعذر حفظ اتفاقية المالك.'");
  });

  it('keeps deferred MASTER_LEASE unavailable without showing a disabled technical choice', () => {
    expect(manager).not.toContain('<option value="master_lease">');
    expect(manager).not.toContain('label="نوع الاتفاقية"');
    expect(propertyForm).not.toContain('<option value="master_lease">');
    expect(service).toContain('الاستئجار الرئيسي غير متاح في الإصدار الحالي');
  });
});
