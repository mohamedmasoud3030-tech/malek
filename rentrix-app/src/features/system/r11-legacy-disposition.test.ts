/**
 * R11 — Legacy Feature Disposition enforcement.
 *
 * docs/decisions/0014-r11-legacy-feature-disposition.md is the register:
 *   Commissions KEEP, Automation KEEP,
 *   Lands/Leads/Communication HIDE-FREEZE,
 *   legacy routes redirect-only, compatibility aliases progressive removal.
 *
 * This suite makes the register executable:
 *   1. the register document exists and names every feature with a decision,
 *   2. frozen features cannot GROW new cross-feature dependency edges
 *      (their architecture-guard allowlist entries stay frozen),
 *   3. retired commissions deep links stay redirect-only in the shell model.
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
    // The forbidden middle state is explicitly banned.
    expect(register).toContain('no "keep provisionally and keep refactoring it"');
  });

  it('frozen features keep their dependency edges frozen (no new integration growth)', () => {
    const archGuard = readFileSync(join(ROOT, 'scripts', 'check-architecture.mjs'), 'utf8');
    // The frozen features today: lands has no outbound deps of its own beyond
    // what the guard already lists; commissions is the ONLY feature allowed to
    // read lands/leads (its source selector). If a new feature starts
    // importing a frozen feature — or a frozen feature gains an allowlist
    // entry — this assertion forces a deliberate register amendment.
    const frozenConsumers = [...archGuard.matchAll(/\['([^']+)'\s*,\s*new Set\(\[([^\]]*)\]\)/g)]
      .filter(([, , deps]) => /'lands'|'leads'|'communication'/.test(deps))
      .map(([, feature]) => feature);
    // FROZEN consumer baseline: commissions (source selector),
    // portfolio-hub (lands shell), relationships-hub (leads/communication
    // shell). Any NEW consumer requires a deliberate register amendment.
    expect(frozenConsumers.sort()).toEqual(['commissions', 'portfolio-hub', 'relationships-hub']);
    // Frozen features must not have their own expanding allowlist entries.
    expect(archGuard).not.toMatch(/\['lands',\s*new Set\(\[[^\]]+\]\)/);
    expect(archGuard).not.toMatch(/\['communication',\s*new Set\(\[[^\]]+\]\)/);
  });

  it('retired legacy deep links are redirect-only in the finance shell model', () => {
    const shell = readFileSync(join(ROOT, 'src', 'features', 'financials', 'finance-shell-model.ts'), 'utf8');
    expect(shell).toContain('isLegacyCommissionsLink');
    // No workspace mounts for the retired link: the resolver maps it to a safe
    // fallback while the shell redirects.
    expect(shell).toContain("sec === 'commissions' || vi === 'commissions'");
  });
});
