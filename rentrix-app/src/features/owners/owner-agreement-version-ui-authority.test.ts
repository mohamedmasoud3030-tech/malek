import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manager = readFileSync(new URL('./OwnerAgreementsManager.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('./ownerAgreementService.ts', import.meta.url), 'utf8');
const propertyForm = readFileSync(new URL('../properties/property-form-modal.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../../supabase/migrations/20260830000000_wp03_gap004_owner_agreement_version_ui_authority.sql', import.meta.url), 'utf8');

describe('GAP-004 owner-agreement version authority', () => {
  it('uses atomic identity plus first-version boundaries for both creation journeys', () => {
    expect(service).toContain("rpc('create_owner_agreement_with_version_atomic'");
    expect(service).toContain("rpc('create_property_with_versioned_agreement_atomic'");
    expect(migration).toContain('public.create_owner_agreement_version_atomic');
    expect(migration).toContain('OWNER_AGREEMENT_INITIAL_VERSION_REQUIRED');
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
    expect(migration.match(/MASTER_LEASE_EXCLUDED_FROM_RC1/g)?.length).toBe(2);
    expect(migration).toContain('revoke all on function public.create_owner_agreement_version_atomic(uuid,jsonb) from authenticated');
    expect(migration).toContain('OWNER_AGREEMENT_VERSION_MUST_BE_FUTURE');
    expect(service).toContain('الاستئجار الرئيسي غير متاح في الإصدار الحالي');
  });
});
