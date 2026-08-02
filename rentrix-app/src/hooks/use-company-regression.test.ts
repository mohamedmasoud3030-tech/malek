import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('active company write guard', () => {
  const companyHook = readFileSync(resolve(import.meta.dirname, 'use-company.tsx'), 'utf8');
  const maintenanceController = readFileSync(resolve(root, 'features/maintenance/useMaintenancePageController.ts'), 'utf8');
  const maintenanceService = readFileSync(resolve(root, 'features/maintenance/maintenance-service.ts'), 'utf8');
  const maintenanceRpc = readFileSync(resolve(root, '../../supabase/migrations/20260731190947_create_maintenance_atomic_rpc.sql'), 'utf8');

  it('queries only company columns that exist in production', () => {
    expect(companyHook).toContain(".select('company_id, role, companies!inner(id, name, slug, currency, locale)')");
    expect(companyHook).not.toContain('role, is_active, companies!inner');
    expect(companyHook).not.toContain('locale, timezone, is_active)');
  });

  it('refreshes the JWT claim and blocks the app when no active company can be resolved', () => {
    expect(companyHook).toContain('supabase.auth.refreshSession()');
    expect(companyHook).toContain('companyList.length === 1');
    expect(companyHook).toContain('hasAuthenticatedSession && (loadError || !activeCompany)');
    expect(companyHook).toContain('لم يتم فتح التطبيق لحماية البيانات ومنع إنشاء سجلات بدون شركة');
  });

  it('derives the maintenance company on the server, not from a browser payload', () => {
    expect(maintenanceController).toContain('const activeCompanyId = useActiveCompanyId()');
    expect(maintenanceController).not.toContain('company_id: activeCompanyId');
    expect(maintenanceController).toContain("form.setError('root', { message: ACTIVE_COMPANY_ERROR })");
    expect(maintenanceService).toContain(".rpc('create_maintenance_atomic'");
    expect(maintenanceRpc).toContain('v_company_id uuid;');
    expect(maintenanceRpc).toContain('v_company_id := public.current_company_id();');
    expect(maintenanceRpc).toContain('AND company_id = v_company_id');
    expect(maintenanceRpc).toContain('AND property_id = v_property.id');
  });
});
