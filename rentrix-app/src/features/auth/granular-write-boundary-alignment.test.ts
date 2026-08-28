import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const boundaryMigration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000054_granular_write_boundary_alignment.sql'),
  'utf8',
);
const propertyService = readFileSync(
  resolve(import.meta.dirname, '../properties/property-service.ts'),
  'utf8',
);
const unitService = readFileSync(
  resolve(import.meta.dirname, '../units/unit-service.ts'),
  'utf8',
);
const contractService = readFileSync(
  resolve(import.meta.dirname, '../contracts/services/contractService.ts'),
  'utf8',
);
const maintenanceService = readFileSync(
  resolve(import.meta.dirname, '../maintenance/maintenance-service.ts'),
  'utf8',
);

describe('granular Employee server write boundaries', () => {
  it('treats property and unit archive as a guarded soft-delete update', () => {
    expect(propertyService).toContain("updatePayload: PropertyUpdate = { deleted_at: new Date().toISOString() }");
    expect(unitService).toContain("updatePayload: UnitUpdate = { deleted_at: new Date().toISOString() }");

    expect(boundaryMigration).toContain("current_user_has_effective_app_permission(''properties.edit'') or public.current_user_has_effective_app_permission(''properties.archive'')");
    expect(boundaryMigration).toContain('v_archive_change := new.deleted_at is distinct from old.deleted_at');
    expect(boundaryMigration).toContain("current_user_has_effective_app_permission('properties.archive')");
    expect(boundaryMigration).toContain("current_user_has_effective_app_permission('properties.edit')");
    expect(boundaryMigration).toContain('PROPERTY_ARCHIVE_PERMISSION_REQUIRED');
    expect(boundaryMigration).toContain('PROPERTY_EDIT_PERMISSION_REQUIRED');
  });

  it('moves archive dependency checks to the trusted database boundary', () => {
    expect(boundaryMigration).toContain('PROPERTY_ARCHIVE_ACTIVE_UNITS');
    expect(boundaryMigration).toContain('PROPERTY_ARCHIVE_OWNER_AGREEMENT');
    expect(boundaryMigration).toContain('PROPERTY_ARCHIVE_OPEN_MAINTENANCE');
    expect(boundaryMigration).toContain('PROPERTY_ARCHIVE_ACTIVE_CONTRACT');
    expect(boundaryMigration).toContain('UNIT_ARCHIVE_CONTRACT_HISTORY');
    expect(boundaryMigration).toContain('UNIT_ARCHIVE_OPEN_MAINTENANCE');
    expect(boundaryMigration).toContain('create or replace function app_private.guard_property_unit_granular_update()');
    expect(boundaryMigration).not.toContain('create or replace function public.guard_property_unit_granular_update()');
    expect(boundaryMigration).toContain('security definer');
  });

  it('does not reinterpret archive permission as hard-delete authority', () => {
    expect(boundaryMigration).toContain("v_name := v_table || '_no_hard_delete'");
    expect(boundaryMigration).toContain('as restrictive for delete to authenticated using (false)');
  });

  it('keeps contracts RPC-only at the database boundary as well as in the frontend', () => {
    expect(contractService).toContain("supabase.rpc('create_contract_atomic_v2'");
    expect(contractService).toContain("supabase.rpc('update_contract_atomic_v2'");
    expect(contractService).toContain("supabase.rpc('terminate_contract_atomic'");
    expect(contractService).toContain("supabase.rpc('soft_delete_contract_atomic'");

    expect(boundaryMigration).toContain("array['insert','update','delete']");
    expect(boundaryMigration).toContain("'contracts_rpc_only_' || v_action");
    expect(boundaryMigration).toContain('as restrictive for insert to authenticated with check (false)');
    expect(boundaryMigration).toContain('as restrictive for update to authenticated using (false) with check (false)');
    expect(boundaryMigration).toContain('as restrictive for delete to authenticated using (false)');
  });

  it('keeps maintenance create/lifecycle commands server-controlled while ordinary edits remain possible', () => {
    expect(maintenanceService).toContain(".rpc('create_maintenance_atomic'");
    expect(maintenanceService).toContain("supabase.rpc('transition_maintenance_status_atomic'");
    expect(maintenanceService).toContain(".from('maintenance_records')\n    .update(payload)");

    expect(boundaryMigration).toContain("v_name := 'maintenance_rpc_only_insert'");
    expect(boundaryMigration).toContain("v_name := 'maintenance_no_hard_delete'");
    expect(boundaryMigration).toContain('pre-existing guard_maintenance_status_transition trigger');
  });
});
