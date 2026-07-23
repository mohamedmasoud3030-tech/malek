import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('active company write guard', () => {
  const companyHook = readFileSync(resolve(import.meta.dirname, 'use-company.tsx'), 'utf8');
  const maintenanceController = readFileSync(
    resolve(import.meta.dirname, '../features/maintenance/useMaintenancePageController.ts'),
    'utf8',
  );

  it('queries only company columns that exist in production', () => {
    expect(companyHook).toContain(
      ".select('company_id, role, companies!inner(id, name, slug, currency, locale)')",
    );
    expect(companyHook).not.toContain('role, is_active, companies!inner');
    expect(companyHook).not.toContain('locale, timezone, is_active)');
  });

  it('refreshes the JWT claim and blocks the app when no active company can be resolved', () => {
    expect(companyHook).toContain('supabase.auth.refreshSession()');
    expect(companyHook).toContain('companyList.length === 1');
    expect(companyHook).toContain('hasAuthenticatedSession && (loadError || !activeCompany)');
    expect(companyHook).toContain('لم يتم فتح التطبيق لحماية البيانات ومنع إنشاء سجلات بدون شركة');
  });

  it('adds the resolved company id to new maintenance requests', () => {
    expect(maintenanceController).toContain('const activeCompanyId = useActiveCompanyId()');
    expect(maintenanceController).toContain('company_id: activeCompanyId');
    expect(maintenanceController).toContain("form.setError('root', { message: ACTIVE_COMPANY_ERROR })");
  });
});
