import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const maintenanceList = readFileSync(
  resolve(import.meta.dirname, '../maintenance/components/maintenance-list.tsx'),
  'utf8',
);
/**
 * The status→permission mapping now lives beside the canonical action matrix in
 * the maintenance controller, because the register row menu and the details
 * overlay both offer the same transitions and must never disagree. The
 * delegation itself is unchanged: technical completion stays under
 * `maintenance.edit`, final close under `maintenance.approve`, and cancellation
 * under `maintenance.cancel`.
 */
const maintenanceController = readFileSync(
  resolve(import.meta.dirname, '../maintenance/useMaintenancePageController.ts'),
  'utf8',
);
const maintenanceOverlay = readFileSync(
  resolve(import.meta.dirname, '../maintenance/components/maintenance-workspace.tsx'),
  'utf8',
);
const maintenanceTransitionMigration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000053_maintenance_transition_permission_alignment.sql'),
  'utf8',
);

describe('maintenance lifecycle action permissions', () => {
  it('keeps technical completion under edit and final close under approval', () => {
    expect(maintenanceController).toContain("if (status === 'closed') return 'maintenance.approve';");
    expect(maintenanceController).toContain("return 'maintenance.edit';");
    expect(maintenanceController).not.toContain("status === 'resolved' || status === 'closed'");

    expect(maintenanceTransitionMigration).toContain(
      "when 'closed' then public.current_user_has_effective_app_permission('maintenance.approve')",
    );
    expect(maintenanceTransitionMigration).toContain(
      "else public.current_user_has_effective_app_permission('maintenance.edit')",
    );
    expect(maintenanceTransitionMigration).not.toContain(
      "when 'resolved' then public.current_user_has_effective_app_permission('maintenance.approve')",
    );
  });

  it('keeps cancellation independently delegated and localized to one shared rule', () => {
    expect(maintenanceController).toContain("if (status === 'cancelled') return 'maintenance.cancel';");
    expect(maintenanceTransitionMigration).toContain(
      "when 'cancelled' then public.current_user_has_effective_app_permission('maintenance.cancel')",
    );
    expect(maintenanceList).toContain('cancelled: "ملغى"');
  });

  it('routes every maintenance surface through the one status-action permission rule', () => {
    // The register and the details overlay must gate transitions identically,
    // so neither may re-derive the mapping locally.
    expect(maintenanceList).toContain('canAccess(getMaintenanceStatusActionPermission(status))');
    expect(maintenanceOverlay).toContain('canAccess(getMaintenanceStatusActionPermission(status))');
    expect(maintenanceList).not.toContain('return canApprove;');
    expect(maintenanceList).not.toContain('return canCancel;');
  });
});
