import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dashboard frontend/backend data contract', () => {
  it('loads arrears once and does not retry the full dashboard request fan-out', () => {
    const snapshotSource = readFileSync(resolve(import.meta.dirname, 'dashboard-snapshot.ts'), 'utf8');
    const pageSource = readFileSync(resolve(import.meta.dirname, 'dashboard-page.tsx'), 'utf8');

    expect(snapshotSource).toContain('getDashboardArrearsReports(arrearsFilters)');
    expect(snapshotSource).not.toContain('getOverdueInvoicesReport(arrearsFilters)');
    expect(snapshotSource).not.toContain('getArrearsSummaryReport(arrearsFilters)');
    expect(snapshotSource).not.toContain('getAgedReceivablesReport(arrearsFilters)');
    expect(pageSource).toContain('retry: false');
  });

  it('keeps authorization helpers one-way and the live dashboard date cast guarded', () => {
    const authMigration = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260718075311_fix_authorization_helper_grants_and_recursion.sql'),
      'utf8',
    ).toLowerCase();
    const dashboardMigration = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260718075504_fix_dashboard_overview_live_type_compatibility.sql'),
      'utf8',
    ).toLowerCase();

    expect(authMigration).toContain('select auth.uid() is not null');
    expect(authMigration).toContain("upper(coalesce(public.current_app_role(), 'user')) in ('admin', 'manager')");
    expect(authMigration).toContain('grant execute on function app_private.is_app_user() to authenticated, service_role');
    expect(authMigration).toContain('grant execute on function app_private.is_admin_or_manager() to authenticated, service_role');
    expect(dashboardMigration).toContain("btrim(coalesce(end_date::text, '')) ~ '^\\d{4}-\\d{2}-\\d{2}$'");
    expect(dashboardMigration).toContain('btrim(end_date::text)::date >= p_as_of');
  });
});
