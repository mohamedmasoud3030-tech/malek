import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const maintenanceList = readFileSync(
  resolve(import.meta.dirname, '../maintenance/components/maintenance-list.tsx'),
  'utf8',
);
const maintenanceTransitionMigration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/20260901000053_maintenance_transition_permission_alignment.sql'),
  'utf8',
);

describe('maintenance lifecycle action permissions', () => {
  it('keeps technical completion under edit and final close under approval', () => {
    expect(maintenanceList).toContain('if (status === "closed") return canApprove;');
    expect(maintenanceList).toContain('return canEdit;');
    expect(maintenanceList).not.toContain('status === "resolved" || status === "closed"');

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

  it('keeps cancellation independently delegated and localized in the register', () => {
    expect(maintenanceList).toContain('if (status === "cancelled") return canCancel;');
    expect(maintenanceTransitionMigration).toContain(
      "when 'cancelled' then public.current_user_has_effective_app_permission('maintenance.cancel')",
    );
    expect(maintenanceList).toContain('cancelled: "ملغى"');
  });
});
