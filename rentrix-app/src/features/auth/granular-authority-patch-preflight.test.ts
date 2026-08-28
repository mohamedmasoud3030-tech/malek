import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000050_granular_authority_patch_preflight.sql'),
  'utf8',
);

describe('granular RPC authority patch preflight', () => {
  it('runs before migration 00051 and refuses ambiguous legacy authority anchors', () => {
    expect(migration).toContain('GRANULAR_AUTHORITY_PREFLIGHT_AMBIGUOUS');
    expect(migration).toContain('v_anchor_count <> 1');
    expect(migration).toContain("'public.is_admin_or_manager()'");
    expect(migration).toContain("'public.is_admin()'");
    expect(migration).toContain("'public.is_app_user()'");
    expect(migration).toContain("current_user_has_effective_app_permission('contracts.write')");
    expect(migration).toContain("current_user_has_effective_app_permission('maintenance.write')");
  });

  it('covers every RPC that migration 00051 rewrites mechanically', () => {
    for (const functionName of [
      'create_contract_atomic',
      'create_contract_atomic_v2',
      'update_contract_atomic',
      'update_contract_atomic_v2',
      'update_contract_billing_policy_atomic',
      'renew_contract_atomic',
      'submit_contract_for_approval_atomic',
      'approve_contract_atomic',
      'reject_contract_atomic',
      'activate_contract_with_agreement_snapshot_atomic',
      'terminate_contract_atomic',
      'soft_delete_contract_atomic',
      'extend_short_stay_contract_atomic',
      'create_maintenance_atomic',
      'close_maintenance_with_expense',
      'resolve_maintenance_with_expense',
    ]) {
      expect(migration).toContain(`('${functionName}',`);
    }
  });

  it('applies the same fail-closed rule to the status-aware maintenance transition patch', () => {
    expect(migration).toContain('transition_maintenance_status_atomic');
    expect(migration).toContain('GRANULAR_MAINTENANCE_PREFLIGHT_AMBIGUOUS');
    expect(migration).toContain('current_user_can_transition_maintenance');
  });
});
