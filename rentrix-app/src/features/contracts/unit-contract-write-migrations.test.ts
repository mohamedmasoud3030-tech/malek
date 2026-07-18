import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function migration(name: string): string {
  return readFileSync(
    join(process.cwd(), '..', 'supabase', 'migrations', name),
    'utf8',
  );
}

const integritySql = migration('20260718231047_unit_contract_integrity_constraints.sql');
const statusSql = migration('20260718231106_unit_operational_status_sync.sql');
const scheduleSql = migration('20260718231116_schedule_unit_status_reconciliation.sql');
const createSql = migration('20260718231142_harden_create_contract_unit_validation.sql');
const updateSql = migration('20260718231208_harden_update_contract_unit_validation.sql');

describe('unit and contract write migration contracts', () => {
  it('prevents duplicate unit numbers and cross-property contract links', () => {
    expect(integritySql).toContain('units_property_unit_number_active_uidx');
    expect(integritySql).toContain('lower(btrim(unit_number))');
    expect(integritySql).toContain('contracts_unit_property_fkey');
    expect(integritySql).toContain('foreign key (unit_id, property_id)');
  });

  it('derives maintenance before current occupancy and preserves manual reservations', () => {
    const maintenancePosition = statusSql.indexOf("then 'maintenance'");
    const occupiedPosition = statusSql.indexOf("then 'occupied'");
    expect(maintenancePosition).toBeGreaterThanOrEqual(0);
    expect(occupiedPosition).toBeGreaterThan(maintenancePosition);
    expect(statusSql).toContain("current_date between btrim(c.start_date)::date and btrim(c.end_date)::date");
    expect(statusSql).toContain("when lower(coalesce(p_fallback_status, '')) = 'reserved' then 'reserved'");
    expect(statusSql).toContain('before insert or update of status on public.units');
  });

  it('keeps time-based unit state synchronized hourly', () => {
    expect(scheduleSql).toContain("'rentrix-unit-status-hourly'");
    expect(scheduleSql).toContain("'5 * * * *'");
    expect(scheduleSql).toContain('select public.recalculate_unit_statuses();');
  });

  it('rejects blocked units and inclusive date overlaps on create', () => {
    expect(createSql).toContain("u.status in ('maintenance', 'reserved')");
    expect(createSql).toContain('btrim(c.start_date)::date <= p_end_date');
    expect(createSql).toContain('btrim(c.end_date)::date >= p_start_date');
    expect(createSql).toContain('p_end_date <= p_start_date');
  });

  it('allows editing the currently linked blocked unit but rejects moving into another', () => {
    expect(updateSql).toContain('p_unit_id is distinct from v_old.unit_id');
    expect(updateSql).toContain("u.status in ('maintenance', 'reserved')");
    expect(updateSql).toContain('c.id <> p_contract_id');
    expect(updateSql).toContain('btrim(c.start_date)::date <= p_end_date');
    expect(updateSql).toContain('btrim(c.end_date)::date >= p_start_date');
  });
});
