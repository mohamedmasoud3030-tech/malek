// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATIC_COMMANDS } from './command-registry';
import { escapePostgREST, normalizeText, scoreResult, useCommandSearch } from './use-command-search';

const mockCanAccess = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    canAccess: mockCanAccess,
    authorization: { role: 'ADMIN', userId: 'user-1' },
  }),
}));
vi.mock('@/hooks/use-company', () => ({ useActiveCompanyId: () => 'company-A' }));
vi.mock('./command-palette-store', () => ({ useCommandPaletteStore: () => ({ isOpen: true }) }));

let queryFnCounter = 0;
let lastQueryFn: any = null;
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn, enabled }: any) => {
    if (enabled) {
      queryFnCounter += 1;
      lastQueryFn = queryFn;
    }
    return { data: [], isLoading: false, isError: false, error: null };
  },
}));

const lastSelectArgs: Record<string, string> = {};
const lastOrArgs: Record<string, string> = {};
const lastIlikeArgs: Record<string, string> = {};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table) => ({
      select: vi.fn().mockImplementation((selectArg) => {
        lastSelectArgs[table] = selectArg;
        const terminal = () => ({ abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }) });
        const mockOr = vi.fn().mockImplementation((orArg) => {
          lastOrArgs[table] = orArg;
          return { limit: vi.fn().mockImplementation(terminal) };
        });
        const mockIlike = vi.fn().mockImplementation((col, val) => {
          lastIlikeArgs[table] = `${col}=${val}`;
          return { limit: vi.fn().mockImplementation(terminal) };
        });
        const mockIs = vi.fn().mockImplementation(() => ({
          or: mockOr,
          ilike: mockIlike,
          limit: vi.fn().mockImplementation(terminal),
        }));
        return {
          is: mockIs,
          or: mockOr,
          ilike: mockIlike,
          limit: vi.fn().mockImplementation(terminal),
        };
      }),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCanAccess.mockReturnValue(true);
  queryFnCounter = 0;
  lastQueryFn = null;
  for (const map of [lastSelectArgs, lastOrArgs, lastIlikeArgs]) {
    for (const key of Object.keys(map)) delete map[key];
  }
});

describe('Global Command Center — task-centric static navigation', () => {
  const command = (id: string) => STATIC_COMMANDS.find((candidate) => candidate.id === id)!;

  it('uses the owning workspace for every secondary capability', () => {
    expect(command('dashboard')).toMatchObject({ title: 'اليوم', canonicalRoute: '/dashboard' });
    expect(command('lands')).toMatchObject({ canonicalRoute: '/properties', search: { section: 'lands' }, permission: 'lands.view' });
    expect(command('owners')).toMatchObject({ canonicalRoute: '/properties', search: { section: 'owners' }, permission: 'owners.hub.view' });
    expect(command('tenants')).toMatchObject({ canonicalRoute: '/contracts', search: { workspace: 'tenants' } });
    expect(command('people')).toMatchObject({ canonicalRoute: '/contracts', search: { workspace: 'people' } });
    expect(command('commissions')).toMatchObject({ canonicalRoute: '/financials', search: { section: 'expenses', view: 'commissions' }, permission: 'commissions.view' });
    expect(command('service-providers')).toMatchObject({ canonicalRoute: '/maintenance', search: { section: 'service_providers' }, permission: 'service_providers.view' });
    expect(command('utilities')).toMatchObject({ canonicalRoute: '/maintenance', search: { section: 'utilities' } });
    expect(command('documents')).toMatchObject({ canonicalRoute: '/maintenance', search: { section: 'documents_vault' } });
    expect(command('automation')).toMatchObject({ canonicalRoute: '/settings', search: { section: 'automation' }, permission: 'automation.view' });
  });

  it('does not expose old list-module routes as static command destinations', () => {
    const routes = STATIC_COMMANDS.map((candidate) => candidate.canonicalRoute);
    for (const retiredStaticDestination of ['/people', '/tenants', '/owners', '/lands', '/commissions', '/service-providers', '/utilities', '/documents-vault', '/automation']) {
      expect(routes).not.toContain(retiredStaticDestination);
    }
  });

  it('filters protected commands with the existing permission seam', () => {
    mockCanAccess.mockImplementation((permission) => permission !== 'lands.view' && permission !== 'commissions.view');
    const { result } = renderHook(() => useCommandSearch(''));
    expect(result.current.staticCommands.some((candidate) => candidate.id === 'lands')).toBe(false);
    expect(result.current.staticCommands.some((candidate) => candidate.id === 'commissions')).toBe(false);
    expect(result.current.staticCommands.some((candidate) => candidate.id === 'settings')).toBe(true);
  });

  it('protects Reports consistently with its route/navigation permission', () => {
    expect(command('reports').permission).toBe('financial.reports.view');
  });
});

describe('Global Command Center — Arabic matching and input safety', () => {
  it('normalizes Arabic characters and whitespace', () => {
    expect(normalizeText('أحمد')).toBe('احمد');
    expect(normalizeText('إبراهيم')).toBe('ابراهيم');
    expect(normalizeText('آمنة')).toBe('امنه');
    expect(normalizeText('مكتبة')).toBe('مكتبه');
    expect(normalizeText('عيسى')).toBe('عيسي');
    expect(normalizeText('   عقار   نشط   ')).toBe('عقار نشط');
  });

  it('ranks exact, prefix and contains matches in that order', () => {
    const query = 'احمد';
    expect(scoreResult('أحمد', '', query)).toBe(100);
    expect(scoreResult('أحمد علي', '', query)).toBe(80);
    expect(scoreResult('سعيد أحمد', '', query)).toBe(50);
    expect(scoreResult('سعيد علي', '', query)).toBe(0);
  });

  it('escapes PostgREST reserved characters before live entity search', () => {
    const escaped = escapePostgREST('محمد,علي (عقار) % _ : . \\');
    for (const token of ['\\,', '\\(', '\\)', '\\:', '\\.', '\\%', '\\_', '\\\\']) expect(escaped).toContain(token);
  });

  it('sends the escaped value through the query builder', () => {
    const value = 'محمد,علي';
    renderHook(() => useCommandSearch(value));
    if (lastQueryFn) void lastQueryFn({ signal: new AbortController().signal });
    expect(lastOrArgs.people).toContain(escapePostgREST(value));
  });
});

describe('Global Command Center — live entity search', () => {
  beforeEach(() => { vi.useFakeTimers(); queryFnCounter = 0; });
  afterEach(() => { vi.useRealTimers(); });

  it('does not run a network entity search below two characters', () => {
    const { result } = renderHook(() => useCommandSearch('ا'));
    expect(result.current.entities).toHaveLength(0);
    expect(queryFnCounter).toBe(0);
  });

  it('debounces fast typing to one entity query', () => {
    let value = 'أ';
    const { rerender } = renderHook(() => useCommandSearch(value));
    act(() => { vi.advanceTimersByTime(100); });
    value = 'أح'; rerender();
    act(() => { vi.advanceTimersByTime(100); });
    value = 'أحم'; rerender();
    act(() => { vi.advanceTimersByTime(100); });
    value = 'أحمد'; rerender();
    act(() => { vi.advanceTimersByTime(300); });
    expect(queryFnCounter).toBe(1);
  });

  it('keeps contract search on its nested property and tenant relations', () => {
    renderHook(() => useCommandSearch('عقد'));
    if (lastQueryFn) void lastQueryFn({ signal: new AbortController().signal });
    expect(lastSelectArgs.contracts).toContain('properties:properties!contracts_property_id_fkey!inner(title)');
    expect(lastSelectArgs.contracts).toContain('people:people!contracts_tenant_id_fkey!inner(full_name)');
    expect(lastOrArgs.contracts).toContain('properties.title.ilike.%عقد%');
    expect(lastOrArgs.contracts).toContain('people.full_name.ilike.%عقد%');
  });
});
