import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    '../../../../supabase/migrations/20260901000047_short_stay_date_driven_expiry.sql',
  ),
  'utf8',
);
const service = readFileSync(
  resolve(import.meta.dirname, './services/shortStayLifecycleService.ts'),
  'utf8',
);
const contractHooks = readFileSync(resolve(import.meta.dirname, './useContracts.ts'), 'utf8');
const unitHooks = readFileSync(resolve(import.meta.dirname, '../units/use-units.ts'), 'utf8');

describe('short stay checkout expiry', () => {
  it('expires only active short stays whose checkout date has arrived', () => {
    expect(migration).toContain("coalesce(lower(c.lease_mode), 'long_term') = 'short_stay'");
    expect(migration).toContain("lower(c.status::text) = 'active'");
    expect(migration).toContain('c.end_date <= current_date');
    expect(migration).toContain("set status = 'expired'");
  });

  it('releases only occupied units without another contract covering today', () => {
    expect(migration).toContain("lower(u.status::text) in ('occupied', 'rented')");
    expect(migration).toContain("set status = 'available'");
    expect(migration).toContain('not exists (');
    expect(migration).toContain('other_contract.start_date <= current_date');
    expect(migration).toContain('other_contract.end_date > current_date');
    expect(migration).not.toMatch(/lower\(u\.status::text\).*maintenance/);
  });

  it('accepts no browser-selected company, contract, unit, date or target status', () => {
    expect(service).toContain("rpc('reconcile_due_short_stays_atomic')");
    // The date-driven reconciliation RPC takes no parameters at all — the
    // server decides everything. (The extension RPC is a separate deliberate
    // operator action and is allowed to name one contract and its new dates.)
    const reconcileCall = service.slice(
      service.indexOf("rpc('reconcile_due_short_stays_atomic')"),
      service.indexOf('}', service.indexOf("rpc('reconcile_due_short_stays_atomic')")),
    );
    expect(reconcileCall).not.toMatch(/p_/);
  });

  it('reconciles before the normal contract and unit operational reads', () => {
    expect(contractHooks).toContain('withShortStayReconciliation');
    expect(unitHooks).toContain('withShortStayReconciliation');
  });
});
