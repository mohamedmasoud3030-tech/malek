import { describe, expect, it } from 'vitest';
import { maintenanceResolveSchema } from './useMaintenancePageController';
import { chargeTargetShortLabels } from './components/maintenance-detail-resolve-overlays';

describe('maintenance responsibility contract', () => {
  it.each(['OWNER', 'TENANT', 'COMPANY'] as const)('accepts the canonical responsibility %s', (chargedTo) => {
    expect(maintenanceResolveSchema.parse({ cost: 12.5, chargedTo, notes: '' }).chargedTo).toBe(chargedTo);
  });

  it('rejects the old presentation-only split target', () => {
    expect(() => maintenanceResolveSchema.parse({
      cost: 12.5,
      chargedTo: 'split_landlord_tenant',
      notes: '',
    })).toThrow();
  });

  it('exposes exactly the three financially supported choices', () => {
    expect(Object.keys(chargeTargetShortLabels).sort()).toEqual(['COMPANY', 'OWNER', 'TENANT']);
  });
});
