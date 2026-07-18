import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260718215711_reconcile_ui_database_value_contracts.sql',
  ),
  'utf8',
);

function functionBody(functionName: string): string {
  const marker = `create or replace function public.${functionName}`;
  const start = migrationSql.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = migrationSql.indexOf('create or replace function public.', start + marker.length);
  return migrationSql.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe('UI/database value contracts', () => {
  it('accepts every maintenance priority and lifecycle state submitted by the UI', () => {
    expect(migrationSql).toContain("array['low', 'medium', 'high', 'urgent']");
    expect(migrationSql).toContain("array['open', 'in_progress', 'resolved', 'closed']");
    expect(migrationSql).toContain("alter column priority set default 'medium'");
    expect(migrationSql).toContain("alter column status set default 'open'");
  });

  it('accepts the complete commission workflow vocabulary', () => {
    expect(migrationSql).toContain("array['pending', 'approved', 'paid', 'cancelled']");
    expect(migrationSql).toContain("alter column status set default 'pending'");
    expect(migrationSql).toContain("when 'rejected' then 'cancelled'");
  });

  it('recomputes both units when a contract or maintenance request moves', () => {
    const body = functionBody('update_unit_status()');
    expect(body).toContain('v_unit_ids := array[old.unit_id, new.unit_id]');
    expect(body).toContain("v_target_status := 'occupied'");
    expect(body).toContain("v_target_status := 'maintenance'");
    expect(body).toContain("v_target_status := 'available'");
    expect(body).not.toContain("'OCCUPIED'");
    expect(body).not.toContain("'MAINTENANCE'");
    expect(body).not.toContain("'AVAILABLE'");
    expect(body).not.toContain("'ACTIVE'");
  });

  it('blocks units for current maintenance states and ignores soft-deleted requests', () => {
    const body = functionBody('check_unit_maintenance_block(p_unit_id uuid)');
    expect(body).toContain("in ('open', 'in_progress')");
    expect(body).toContain('m.deleted_at is null');
    expect(body).toContain("coalesce(m.priority, 'medium')");
    expect(body).not.toContain("'NEW'");
    expect(body).not.toContain("'NORMAL'");
  });

  it('fails closed instead of coercing unknown production values', () => {
    expect(migrationSql).toContain('Unknown maintenance value contract(s)');
    expect(migrationSql).toContain('Unknown commission status contract(s)');
    expect(migrationSql).toContain('raise exception');
  });
});
