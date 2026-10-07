import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const unitsList = readFileSync(
  resolve(import.meta.dirname, '../units/units-list.tsx'),
  'utf8',
);

describe('cross-workspace affordance permissions', () => {
  it('does not query or expose contract drafts from the unit register without contract visibility', () => {
    expect(unitsList).toContain('const canViewContracts = canAccess("contracts.view");');
    expect(unitsList).toContain('unitIds: canViewContracts ? unitsQuery.data?.map((unit) => unit.id) ?? [] : []');
    expect(unitsList).toContain('canViewContracts && unitDraftsByUnitId.has(unit.id)');
  });

  it('keeps leasing creation behind the exact contract-create permission', () => {
    expect(unitsList).toContain('const canCreateContract = canAccess("contracts.create");');
    expect(unitsList).toContain('unit.status === "available" && canCreateContract');
  });
});
