import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { AuditLogView } from '@/features/audit/components/audit-log-view';
import { fetchAuditLog, normalizeAuditRecords } from '@/features/audit/services/audit-log-service';
import { canShowNavigationItem } from '@/features/auth/permissions';
import { assertSessionPermission } from '@/features/auth/route-guards';
import { DataIntegrityView } from './components/data-integrity-view';
import { DATA_INTEGRITY_MAX_PAGES, DATA_INTEGRITY_PAGE_SIZE, buildDataIntegritySnapshot, fetchPaginatedRows } from './services/data-integrity-service';
import { navGroups, type NavItem } from '@/app/navigation/app-nav-items';

vi.mock('@/features/settings/useCompanySettings', async () => {
  const { testCompanySettingsContract } = await import('@/test/companySettingsContractMock');

  return { useCompanySettingsContract: () => testCompanySettingsContract };
});

vi.mock('@/lib/runtime-diagnostics', () => ({
  getEnvDiagnostics: vi.fn(() => []),
  parseSupabaseDiagnostics: vi.fn(() => []),
}));

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://invalid.supabase.local',
    supabaseAnonKey: 'invalid-anon-key',
    isConfigured: false,
  },
}));

type IntegritySnapshotInput = Parameters<typeof buildDataIntegritySnapshot>[0];

const makeSession = (role: string) => ({
  user: {
    id: `user-${role}`,
    email: `${role.toLowerCase()}@example.com`,
    app_metadata: { user_role: role },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-06-04T00:00:00.000Z',
  },
});

const adminSession = makeSession('ADMIN');
const userSession = makeSession('USER');
const unknownRoleSession = makeSession('OWNER');

const baseIntegrityInput = (): IntegritySnapshotInput => ({
  properties: [{ id: 'property-1', deleted_at: null }],
  units: [{ id: 'unit-1', property_id: 'property-1', deleted_at: null }],
  people: [{ id: 'tenant-1', type: 'tenant', deleted_at: null }],
  contracts: [{ id: 'contract-1', property_id: 'property-1', unit_id: 'unit-1', tenant_id: 'tenant-1', start_date: '2026-01-01', end_date: '2026-12-31', deleted_at: null }],
  invoices: [{ id: 'invoice-1', contract_id: 'contract-1', amount: 100, paid_amount: 100, deleted_at: null }],
});

function getIntegrityCount(input: IntegritySnapshotInput, checkId: string): number {
  const result = buildDataIntegritySnapshot(input);
  if (result.status !== 'available') throw new Error('Expected available integrity snapshot');

  return result.snapshot.checks.find((check) => check.id === checkId)?.count ?? -1;
}

describe('system and governance route authorization', () => {
  it('allows a route when the current session has the required permission', () => {
    expect(() => assertSessionPermission(adminSession, 'audit.view')).not.toThrow();
  });

  it('denies direct route access when the current session lacks the required permission', () => {
    expect(() => assertSessionPermission(userSession, 'audit.view')).toThrow();
  });

  it('fails closed for missing and unknown role claims', () => {
    expect(() => assertSessionPermission(null, 'system.view')).toThrow();
    expect(() => assertSessionPermission(unknownRoleSession, 'system.view')).toThrow();
  });

  it('exposes governance surfaces in navigation from v0.3 onwards', () => {
    const systemItems: readonly NavItem[] = navGroups
      .find(([sectionTitle]) => sectionTitle === 'إدارة النظام')?.[1] ?? [];
    const settingsItems: readonly NavItem[] = navGroups
      .find(([sectionTitle]) => sectionTitle === 'الإعدادات والحساب')?.[1] ?? [];
    console.log("Settings Items before filter:", settingsItems);
    const adminContext = { userId: 'user-1', email: 'admin@example.com', role: 'ADMIN' as const };
    const systemRoutes = systemItems.map(([to]) => to);

    expect(systemRoutes).toEqual(expect.arrayContaining(['/audit-log', '/data-integrity', '/system']));
    expect(systemRoutes).toContain('/audit-log');
    expect(systemRoutes).toContain('/data-integrity');
    expect(systemRoutes).not.toContain('/change-password');
    const filteredSettingsItems = settingsItems.filter(([, , , , permission]) => {
      const canShow = canShowNavigationItem(adminContext, permission);
      console.log(`Checking permission ${permission} for adminContext, result: ${canShow}`);
      return canShow;
    }).map(([to]) => to);
    console.log("Filtered Settings Items:", filteredSettingsItems);
    expect(filteredSettingsItems).toEqual(expect.arrayContaining(['/settings']));
  });
});

describe('audit log recovery states', () => {
  it('renders the audit loading state', () => {
    expect(renderToStaticMarkup(<AuditLogView state={{ status: 'loading' }} />)).toContain('role="status"');
  });

  it('renders the audit empty state', () => {
    const html = renderToStaticMarkup(<AuditLogView state={{ status: 'ready', result: { status: 'available', records: [] } }} />);
    expect(html).toContain('لا توجد أحداث تدقيق');
  });

  it('renders the audit recoverable error state', () => {
    const html = renderToStaticMarkup(<AuditLogView state={{ status: 'error', error: new Error('audit failed') }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('تعذر تحميل سجل التدقيق');
  });

  it('renders audit success rows when a verified source supplies records', () => {
    const records = normalizeAuditRecords([{ id: 'a-1', created_at: '2026-06-04T00:00:00.000Z', username: 'admin@example.com', action: 'VIEW', entity: 'settings', entity_id: 's-1', note: '[...]', ts: null, user_id: null, table: null, details: null, updated_at: null }]);
    const html = renderToStaticMarkup(<AuditLogView state={{ status: 'ready', result: { status: 'available', records } }} />);
    expect(html).toContain('admin@example.com');
    expect(html).toContain('VIEW');
    expect(html).toContain('settings / s-1');
  });

  it('returns a safe unavailable audit result until schema assumptions are verified', async () => {
    await expect(fetchAuditLog()).resolves.toMatchObject({ status: 'unavailable' });
  });
});

describe('data integrity audit recovery states', () => {
  it('renders the integrity loading state', () => {
    expect(renderToStaticMarkup(<DataIntegrityView state={{ status: 'loading' }} />)).toContain('role="status"');
  });

  it('renders the integrity unavailable state', () => {
    const html = renderToStaticMarkup(<DataIntegrityView state={{ status: 'ready', result: { status: 'unavailable', reason: 'schema unavailable' } }} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('schema unavailable');
  });

  it('renders supported integrity check results', () => {
    const result = buildDataIntegritySnapshot({
      properties: [{ id: 'property-1', deleted_at: null }],
      units: [{ id: 'unit-1', property_id: 'missing-property', deleted_at: null }],
      people: [{ id: 'tenant-1', type: 'tenant', deleted_at: null }],
      contracts: [{ id: 'contract-1', property_id: 'property-1', unit_id: 'unit-1', tenant_id: 'tenant-1', start_date: '2026-01-01', end_date: '2026-12-31', deleted_at: null }],
      invoices: [{ id: 'invoice-1', contract_id: 'contract-1', amount: 100, paid_amount: 150, deleted_at: null }],
    });
    const html = renderToStaticMarkup(<DataIntegrityView state={{ status: 'ready', result }} />);
    expect(html).toContain('تدقيق سلامة البيانات');
    expect(html).toContain('وحدات بلا عقار نشط');
    expect(html).toContain('فواتير مدفوعة بأكثر من قيمتها');
  });
});

describe('data integrity pagination', () => {
  it('reads more than one page deterministically', async () => {
    const firstPage = Array.from({ length: DATA_INTEGRITY_PAGE_SIZE }, (_, index) => ({ id: `row-${index}` }));
    const secondPage = [{ id: 'row-final' }];
    const range = vi.fn((from: number) => Promise.resolve({ data: from === 0 ? firstPage : secondPage, error: null }));

    const result = await fetchPaginatedRows(() => ({ range }));

    expect(result).toMatchObject({ status: 'available' });
    if (result.status !== 'available') throw new Error('Expected paginated rows to be available');
    expect(result.rows).toHaveLength(DATA_INTEGRITY_PAGE_SIZE + 1);
    expect(range).toHaveBeenCalledWith(0, DATA_INTEGRITY_PAGE_SIZE - 1);
    expect(range).toHaveBeenCalledWith(DATA_INTEGRITY_PAGE_SIZE, DATA_INTEGRITY_PAGE_SIZE * 2 - 1);
  });

  it('stops on a short final page', async () => {
    const shortPage = [{ id: 'row-1' }];
    const range = vi.fn(() => Promise.resolve({ data: shortPage, error: null }));

    await expect(fetchPaginatedRows(() => ({ range }))).resolves.toMatchObject({ status: 'available', rows: shortPage });
    expect(range).toHaveBeenCalledOnce();
  });

  it('returns unavailable instead of a false clean result when the safety maximum is reached', async () => {
    const fullPage = Array.from({ length: DATA_INTEGRITY_PAGE_SIZE }, (_, index) => ({ id: `row-${index}` }));
    const range = vi.fn(() => Promise.resolve({ data: fullPage, error: null }));

    await expect(fetchPaginatedRows(() => ({ range }))).resolves.toMatchObject({ status: 'unavailable' });
    expect(range).toHaveBeenCalledTimes(DATA_INTEGRITY_MAX_PAGES);
  });
});

describe('data integrity tenant validation', () => {
  it('accepts an active tenant person', () => {
    expect(getIntegrityCount(baseIntegrityInput(), 'orphan-contracts')).toBe(0);
  });

  it('rejects an owner person used as tenant', () => {
    const input = { ...baseIntegrityInput(), people: [{ id: 'tenant-1', type: 'owner' as const, deleted_at: null }] };

    expect(getIntegrityCount(input, 'orphan-contracts')).toBe(1);
  });

  it('rejects a contact person used as tenant', () => {
    const input = { ...baseIntegrityInput(), people: [{ id: 'tenant-1', type: 'contact' as const, deleted_at: null }] };

    expect(getIntegrityCount(input, 'orphan-contracts')).toBe(1);
  });

  it('rejects a deleted tenant', () => {
    const input = { ...baseIntegrityInput(), people: [{ id: 'tenant-1', type: 'tenant' as const, deleted_at: '2026-06-04T00:00:00.000Z' }] };

    expect(getIntegrityCount(input, 'orphan-contracts')).toBe(1);
  });

  it('rejects a missing tenant', () => {
    const input = { ...baseIntegrityInput(), people: [] };

    expect(getIntegrityCount(input, 'orphan-contracts')).toBe(1);
  });
});

describe('data integrity unit-property validation', () => {
  it('accepts an active unit under the matching property', () => {
    expect(getIntegrityCount(baseIntegrityInput(), 'invalid-contract-units')).toBe(0);
  });

  it('rejects a unit under a different property', () => {
    const input = {
      ...baseIntegrityInput(),
      properties: [{ id: 'property-1', deleted_at: null }, { id: 'property-2', deleted_at: null }],
      units: [{ id: 'unit-1', property_id: 'property-2', deleted_at: null }],
    };

    expect(getIntegrityCount(input, 'invalid-contract-units')).toBe(1);
  });

  it('rejects a missing unit', () => {
    const input = { ...baseIntegrityInput(), units: [] };

    expect(getIntegrityCount(input, 'invalid-contract-units')).toBe(1);
  });

  it('rejects a deleted unit', () => {
    const input = { ...baseIntegrityInput(), units: [{ id: 'unit-1', property_id: 'property-1', deleted_at: '2026-06-04T00:00:00.000Z' }] };

    expect(getIntegrityCount(input, 'invalid-contract-units')).toBe(1);
  });
});

describe('system governance dependency boundaries', () => {
  it('does not introduce historical AppContext or React Router dependencies', () => {
    const files = [
      '../audit/audit-log-page.tsx',
      '../audit/components/audit-log-view.tsx',
      './data-integrity-page.tsx',
      './components/data-integrity-view.tsx',
      './system-page.tsx',
      '../auth/change-password-page.tsx',
    ];

    for (const relativePath of files) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).not.toContain('AppContext');
      expect(source).not.toContain('useApp');
      expect(source).not.toContain('react-router-dom');
    }
  });

  it('keeps audit and integrity services free of write operations', () => {
    const files = ['../audit/services/audit-log-service.ts', './services/data-integrity-service.ts'];

    for (const relativePath of files) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).not.toMatch(/\.insert\s*\(/);
      expect(source).not.toMatch(/\.update\s*\(/);
      expect(source).not.toMatch(/\.delete\s*\(/);
      expect(source).not.toMatch(/\.rpc\s*\(/);
    }
  });
});
