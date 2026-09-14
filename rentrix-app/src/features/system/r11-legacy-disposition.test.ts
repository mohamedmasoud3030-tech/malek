/** R11 — Legacy Feature Disposition enforcement. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const registerPath = join(ROOT, '..', 'docs', 'decisions', '0014-r11-legacy-feature-disposition.md');

describe('R11 — legacy disposition register', () => {
  it('the register exists and assigns exactly one decision per feature', () => {
    const register = readFileSync(registerPath, 'utf8');
    expect(register).toContain('| Commissions | **KEEP**');
    expect(register).toContain('| Automation | **KEEP**');
    expect(register).toContain('| Lands | **HIDE/FREEZE**');
    expect(register).toContain('| Leads | **HIDE/FREEZE**');
    expect(register).toContain('| Communication | **HIDE/FREEZE**');
    expect(register).toContain('| Legacy routes | **KEEP (as redirects only)**');
    expect(register).toContain('| Compatibility aliases | **REMOVE (progressively');
    expect(register).toContain('no "keep provisionally and keep refactoring it"');
  });

  it('frozen features keep their dependency edges frozen', () => {
    const archGuard = readFileSync(join(ROOT, 'scripts', 'check-architecture.mjs'), 'utf8');
    const frozenConsumers = [...archGuard.matchAll(/\['([^']+)'\s*,\s*new Set\(\[([^\]]*)\]\)/g)]
      .filter(([, , deps]) => /'lands'|'leads'|'communication'/.test(deps))
      .map(([, feature]) => feature);
    expect(frozenConsumers.sort()).toEqual(['automation', 'commissions']);
    expect(archGuard).not.toMatch(/\['lands',\s*new Set\(\[[^\]]+\]\)/);
    expect(archGuard).not.toMatch(/\['communication',\s*new Set\(\[[^\]]+\]\)/);
    expect(archGuard).not.toContain("['relationships-hub'");
    expect(archGuard).not.toContain("['operations-hub'");
    expect(archGuard).not.toContain("['governance-hub'");
  });

  it('retired legacy finance deep links resolve only through the canonical finance shell model', () => {
    const shell = readFileSync(join(ROOT, 'src', 'features', 'finance', 'shell', 'financeShellModel.ts'), 'utf8');
    expect(shell).toContain("sec === 'commissions' || vi === 'commissions'");
    expect(shell).toContain("vi === 'fixed_monthly_accruals'");
    expect(shell).not.toContain('isLegacyCommissionsLink');
  });
});
