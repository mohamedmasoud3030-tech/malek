import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('active company write guard', () => {
  const companyHook = readFileSync(resolve(import.meta.dirname, 'use-company.tsx'), 'utf8');
  const authHook = readFileSync(resolve(import.meta.dirname, 'use-auth.tsx'), 'utf8');
  const maintenanceController = readFileSync(resolve(root, 'features/maintenance/useMaintenancePageController.ts'), 'utf8');
  const maintenanceService = readFileSync(resolve(root, 'features/maintenance/maintenance-service.ts'), 'utf8');
  const maintenanceRpc = readFileSync(resolve(root, '../../supabase/migrations/20260731190947_create_maintenance_atomic_rpc.sql'), 'utf8');

  it('queries only stable production columns and active tenant memberships', () => {
    expect(companyHook).toContain(".select('company_id, role, companies!inner(id, name, slug, currency, locale)')");
    expect(companyHook).toContain(".eq('is_active', true)");
    expect(companyHook).toContain(".eq('companies.is_active', true)");
    expect(companyHook).not.toContain('role, is_active, companies!inner');
    expect(companyHook).not.toContain('locale, timezone, is_active)');
  });

  it('resolves from authorized memberships with the hook-aligned deterministic order', () => {
    expect(companyHook).toContain(".order('created_at', { ascending: true })");
    expect(companyHook).toContain(".order('id', { ascending: true })");
    expect(companyHook).toContain('pickClaimMatchedCompany(companyList, jwtCompanyId)');
    expect(companyHook).not.toContain('companyList.length === 1');
  });

  it('reads transient custom-hook company claims from the issued access token, never the Auth user record', () => {
    expect(companyHook).toContain('readCompanyIdFromAccessToken(sessionAccessToken)');
    expect(companyHook).toContain('readCompanyIdFromAccessToken(refreshed.session?.access_token)');
    expect(companyHook).toContain('readCompanyIdFromAccessToken(session.access_token)');
    expect(companyHook).not.toContain('readCompanyIdFromAppMetadata(sessionUser.app_metadata)');
    expect(companyHook).not.toContain('readCompanyIdFromAppMetadata(refreshed.session?.user.app_metadata)');
    expect(companyHook).not.toContain('readCompanyIdFromAppMetadata(session.user.app_metadata)');
  });

  it('syncs the JWT server-side and verifies the issued claim before unlocking', () => {
    expect(companyHook).toContain('supabase.auth.refreshSession()');
    expect(companyHook).toContain('requestServerClaimSync');
    expect(companyHook).toContain('data: { company_id: companyId }');
    expect(companyHook).toContain('verifiedClaim !== membershipDefault.id');
    expect(companyHook).toContain('verifiedClaim !== companyId');
    expect(companyHook).toContain('hasAuthenticatedSession && (loadError || !activeCompany)');
    expect(companyHook).toContain('لم يتم فتح التطبيق لحماية البيانات ومنع إنشاء سجلات بدون شركة');
  });

  it('keeps TOKEN_REFRESHED session state authoritative for company switching', () => {
    expect(authHook).toContain("case 'TOKEN_REFRESHED':");
    expect(authHook).toContain('setSession(nextSession)');
  });

  it('clears tenant query data before exposing the newly selected company', () => {
    expect(companyHook).toContain('const queryClient = useQueryClient()');
    expect(companyHook).toContain('await queryClient.cancelQueries()');
    expect(companyHook).toContain('queryClient.clear()');
    expect(companyHook.indexOf('queryClient.clear()')).toBeLessThan(companyHook.indexOf('setActiveCompany(company)'));
  });

  it('fails closed and clears tenant cache across logout/login user changes', () => {
    expect(companyHook).toContain('const [resolvedUserId, setResolvedUserId]');
    expect(companyHook).toContain('const isCompanyContextTransition = authenticatedUserId !== resolvedUserId');
    expect(companyHook).toContain('if (isLoading || isCompanyContextTransition)');
    expect(companyHook).toContain('setResolvedUserId(sessionUser.id)');
    expect(companyHook).toContain('setResolvedUserId(null)');
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
