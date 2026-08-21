import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('contract register display architecture', () => {
  const table = readFileSync(resolve(import.meta.dirname, './ContractTable.tsx'), 'utf8');

  it('uses EntityTable with a dense mobile hierarchy led by the tenant', () => {
    expect(table).toContain('EntityTable');
    expect(table).toContain('mobileVisibleSecondaryKeys={["tenant", "unit", "status"]}');
    expect(table).toContain("priority: \"identity\"");
    expect(table).toContain("priority: \"primary\"");
    expect(table).toContain("priority: \"actions\"");
  });

  it('does not ship a page-local ContractMobileCard module', () => {
    expect(existsSync(resolve(import.meta.dirname, './ContractMobileCard.tsx'))).toBe(false);
    expect(table).not.toContain('ContractMobileCard');
  });
});
