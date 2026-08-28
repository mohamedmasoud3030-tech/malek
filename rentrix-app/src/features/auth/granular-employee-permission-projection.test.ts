import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000051_granular_employee_permission_projection.sql'),
  'utf8',
);

describe('granular employee permission projection', () => {
  it('mirrors effective authority precedence for legacy broad parents', () => {
    expect(migration).toContain('exact_override.allowed');
    expect(migration).toContain('parent_override.allowed');
    expect(migration).toContain("when 'properties.create' then 'properties.write'");
    expect(migration).toContain("when 'contracts.approve' then 'contracts.write'");
    expect(migration).toContain("when 'maintenance.cancel' then 'maintenance.write'");
    expect(migration).toContain('public.role_has_app_permission(cm.role::text, parent.permission)');
    expect(migration).toContain('g.permission = parent.permission');
  });

  it('marks only exact granular owner decisions as explicitly set', () => {
    expect(migration).toContain('(exact_override.permission is not null) as explicitly_set');
    expect(migration).not.toContain('(parent_override.permission is not null) as explicitly_set');
  });
});
