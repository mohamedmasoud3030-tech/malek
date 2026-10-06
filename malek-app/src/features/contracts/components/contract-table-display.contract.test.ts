import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('contract register display architecture', () => {
  const table = readFileSync(resolve(import.meta.dirname, './ContractTable.tsx'), 'utf8');

  it('uses EntityTable with explicit mobile hierarchy (tenant as primary datum)', () => {
    expect(table).toContain('EntityTable');
    expect(table).not.toContain('mobileVisibleSecondaryKey="tenant"');
    expect(table).toContain("priority: \"identity\"");
    expect(table).toContain("priority: \"primary\"");
    expect(table).toContain("priority: \"actions\"");
  });

  it('does not ship a page-local ContractMobileCard module', () => {
    expect(existsSync(resolve(import.meta.dirname, './ContractMobileCard.tsx'))).toBe(false);
    expect(table).not.toContain('ContractMobileCard');
  });

it('exposes attention and next action through canonical column and mobile metadata config', () => {
    expect(table).toContain('{ key: "attention", label: "المتابعة" }');
    expect(table).toContain('{ key: "next_action", label: "الإجراء التالي" }');
    expect(table).toContain('mobilePrimaryMetaKeys={["attention", "unit", "period"]}');
    expect(table).toContain('mobileSecondaryMetaKeys={["rent_amount", "next_action"]}');
  });

  it('takes the next step from the canonical lifecycle rules, not a UI-local copy', () => {
    expect(table).toContain('getContractNextAction');
    expect(table).not.toContain('canRenewContract(contract)');
    expect(table).not.toContain('canTerminateContract(contract)');
    expect(table).not.toContain('isContractApprovalPending(contract)');
  });
});
