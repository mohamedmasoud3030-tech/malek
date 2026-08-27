/**
 * R11 — Legacy Feature Disposition enforcement.
 *
 * docs/decisions/0014-r11-legacy-feature-disposition.md is the register:
 *   Commissions KEEP, Automation KEEP,
 *   Lands/Leads/Communication HIDE-FREEZE,
 *   legacy routes redirect-only, compatibility aliases progressive removal.
 */
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

  it('frozen features keep their dependency edges frozen (no new integration growth)', () => {
    const archGuard = readFileSync(join(ROOT, 'scripts', 'check-architecture.mjs'), 'utf8');
    const frozenConsumers = [...archGuard.matchAll(/\['([^']+)'\s*,\s*new Set\(\[([^\]]*)\]\)/g)]
      .filter(([, , deps]) => /'lands'|'leads'|'communication'/.test(deps))
      .map(([, feature]) => feature);

    expect(frozenConsumers.sort()).toEqual(['automation', 'commissions', 'portfolio-hub', 'relationships-hub']);
    expect(archGuard).not.toMatch(/\['lands',\s*new Set\(\[[^\]]+\]\)/);
    expect(archGuard).not.toMatch(/\['communication',\s*new Set\(\[[^\]]+\]\)/);
  });

  it('retired legacy deep links are redirect-only in the canonical finance shell model', () => {
    const shell = readFileSync(join(ROOT, 'src', 'features', 'finance', 'shell', 'financeShellModel.ts'), 'utf8');
    expect(shell).toContain('isLegacyCommissionsLink');
    expect(shell).toContain("sec === 'commissions' || vi === 'commissions'");
  });
});
