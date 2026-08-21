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

  it('exposes version history and future amendments instead of retroactive commercial edits', () => {
    expect(manager).toContain('سجل النسخ');
    expect(manager).toContain('تعديل مستقبلي');
    expect(manager).toContain('useCreateOwnerAgreementVersion');
    expect(service).toContain("rpc('create_future_owner_agreement_version_atomic'");
  });

  it('keeps deferred MASTER_LEASE unavailable in RC1 creation screens and boundaries', () => {
    expect(manager).not.toContain('<option value="master_lease">');
    expect(propertyForm).not.toContain('<option value="master_lease">');
    expect(service).toContain('الاستئجار الرئيسي غير متاح في الإصدار الحالي');
  });
});
