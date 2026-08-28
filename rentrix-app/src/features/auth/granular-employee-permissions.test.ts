import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appPermissions, employeeActionPermissions, getPermissionLabel } from './permissions';

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000050_granular_employee_action_permissions.sql'),
  'utf8',
);

describe('granular Employee action permissions', () => {
  it('exposes only real domain actions instead of another role taxonomy', () => {
    expect(employeeActionPermissions.properties).toEqual({
      view: 'properties.view',
      create: 'properties.create',
      edit: 'properties.edit',
      cancel: 'properties.archive',
    });
    expect(employeeActionPermissions.contracts).toEqual({
      view: 'contracts.view',
      create: 'contracts.create',
      edit: 'contracts.edit',
      approve: 'contracts.approve',
      cancel: 'contracts.cancel',
    });
    expect(employeeActionPermissions.maintenance).toEqual({
      view: 'maintenance.view',
      create: 'maintenance.create',
      edit: 'maintenance.edit',
      approve: 'maintenance.approve',
      cancel: 'maintenance.cancel',
    });
    expect(getPermissionLabel('contracts.approve')).toBe('اعتماد');
    expect(appPermissions).toContain('maintenance.cancel');
  });

  it('makes broad writes compatibility-only and replaces both permissive and restrictive RLS gates', () => {
    expect(migration).toContain("requestable = false");
    expect(migration).toContain("'properties.write', 'contracts.write', 'maintenance.write'");
    expect(migration).toContain("('properties','properties.create','properties.edit','properties.archive')");
    expect(migration).toContain("('contracts','contracts.create','contracts.edit','contracts.cancel')");
    expect(migration).toContain("('maintenance_records','maintenance.create','maintenance.edit','maintenance.cancel')");
    expect(migration).toContain("'_action_insert_guard'");
    expect(migration).toContain("'_action_update_guard'");
    expect(migration).toContain("'_action_delete_guard'");
  });

  it('puts approval, cancellation and Short Stay extension behind server command permissions', () => {
    expect(migration).toContain("('approve_contract_atomic','contracts.approve')");
    expect(migration).toContain("('activate_contract_with_agreement_snapshot_atomic','contracts.approve')");
    expect(migration).toContain("('terminate_contract_atomic','contracts.cancel')");
    expect(migration).toContain("('extend_short_stay_contract_atomic','contracts.edit')");
    expect(migration).toContain("('close_maintenance_with_expense','maintenance.approve')");
    expect(migration).toContain('current_user_can_transition_maintenance');
    expect(migration).toContain("when 'cancelled' then public.current_user_has_effective_app_permission('maintenance.cancel')");
  });

  it('keeps action/workspace dependencies fail-closed', () => {
    expect(migration).toContain("array['contracts.create','contracts.edit','contracts.approve','contracts.cancel']");
    expect(migration).toContain("array['maintenance.create','maintenance.edit','maintenance.approve','maintenance.cancel']");
    expect(migration).toContain("'WORKSPACE_DISABLED'");
    expect(migration).toContain("'AUTO_DEPENDENCY'");
  });
});
