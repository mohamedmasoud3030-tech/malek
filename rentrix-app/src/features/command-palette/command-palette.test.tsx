// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { STATIC_COMMANDS } from './command-registry';
import { normalizeText, scoreResult, useCommandSearch, escapePostgREST } from './use-command-search';
import { supabase } from '@/lib/supabase';

// Mock auth hook
const mockCanAccess = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    canAccess: mockCanAccess,
    authorization: { role: 'ADMIN', userId: 'user-1' },
  }),
}));

// Mock active company hook
vi.mock('@/hooks/use-company', () => ({
  useActiveCompanyId: () => 'company-A',
}));

// Mock store
vi.mock('./command-palette-store', () => ({
  useCommandPaletteStore: () => ({
    isOpen: true,
  }),
}));

// Mock react-query to trigger queryFn and track count of requests
let queryFnCounter = 0;
let lastSignal: any = null;
let lastQueryFn: any = null;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, queryFn, enabled }: any) => {
    if (enabled) {
      queryFnCounter++;
      lastQueryFn = queryFn;
    }
    return {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    };
  },
}));

// Mock tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ pathname: '/dashboard' }),
  useNavigate: () => vi.fn(),
  useSearch: () => ({ search: '' }),
}));

// Mock supabase client to track queries and their exact filter string arguments
const lastSelectArgs: Record<string, string> = {};
const lastOrArgs: Record<string, string> = {};
const lastIlikeArgs: Record<string, string> = {};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table) => {
      return {
        select: vi.fn().mockImplementation((selectArg) => {
          lastSelectArgs[table] = selectArg;
          
          const mockOr = vi.fn().mockImplementation((orArg) => {
            lastOrArgs[table] = orArg;
            return {
              limit: vi.fn().mockImplementation(() => ({
                abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            };
          });

          const mockIlike = vi.fn().mockImplementation((col, val) => {
            lastIlikeArgs[table] = `${col}=${val}`;
            return {
              limit: vi.fn().mockImplementation(() => ({
                abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
              })),
            };
          });

          const mockIs = vi.fn().mockImplementation(() => ({
            or: mockOr,
            ilike: mockIlike,
            limit: vi.fn().mockImplementation(() => ({
              abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          }));

          return {
            is: mockIs,
            or: mockOr,
            ilike: mockIlike,
            limit: vi.fn().mockImplementation(() => ({
              abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          };
        }),
      };
    }),
  },
}));

describe('Phase 6 & 6.1 — Command Palette Registry & Static Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccess.mockReturnValue(true);
    queryFnCounter = 0;
    // Clear the query arguments dictionaries
    for (const key of Object.keys(lastSelectArgs)) delete lastSelectArgs[key];
    for (const key of Object.keys(lastOrArgs)) delete lastOrArgs[key];
    for (const key of Object.keys(lastIlikeArgs)) delete lastIlikeArgs[key];
  });

  it('Static Command Registry is the single source of truth for static destinations', () => {
    expect(STATIC_COMMANDS.length).toBeGreaterThan(10);

    const dashboardCmd = STATIC_COMMANDS.find(c => c.id === 'dashboard');
    const peopleCmd = STATIC_COMMANDS.find(c => c.id === 'people');

    expect(dashboardCmd).toBeDefined();
    expect(peopleCmd).toBeDefined();
    expect(dashboardCmd?.canonicalRoute).toBe('/dashboard');
    expect(peopleCmd?.canonicalRoute).toBe('/people');
  });

  it('enforces permission filtering: does not expose protected static routes when user lacks permission', () => {
    mockCanAccess.mockImplementation((permission) => {
      if (permission === 'lands.view' || permission === 'settings.manage') return false;
      return true;
    });

    const { result } = renderHook(() => useCommandSearch(''));
    const landsExists = result.current.staticCommands.some(c => c.id === 'lands');
    const settingsExists = result.current.staticCommands.some(c => c.id === 'settings');

    expect(landsExists).toBe(false);
    expect(settingsExists).toBe(true); // Settings is the canonical shell; its children remain permission-gated
  });
});

describe('Phase 6 & 6.1 — Arabic Text Normalization & Simple Ranking', () => {
  it('normalizes Arabic characters (folding أإآ -> ا, ة -> ه, ى -> ي)', () => {
    expect(normalizeText('أحمد')).toBe('احمد');
    expect(normalizeText('إبراهيم')).toBe('ابراهيم');
    expect(normalizeText('آمنة')).toBe('امنه');
    expect(normalizeText('مكتبة')).toBe('مكتبه');
    expect(normalizeText('عيسى')).toBe('عيسي');
    expect(normalizeText('   عقار   نشط   ')).toBe('عقار نشط');
  });

  it('calculates search match ranking weights correctly', () => {
    const query = 'احمد';

    const scoreExact = scoreResult('أحمد', '', query);
    const scoreStarts = scoreResult('أحمد علي', '', query);
    const scoreIncludes = scoreResult('سعيد أحمد', '', query);
    const scoreNone = scoreResult('سعيد علي', '', query);

    expect(scoreExact).toBe(100);
    expect(scoreStarts).toBe(80);
    expect(scoreIncludes).toBe(50);
    expect(scoreNone).toBe(0);

    expect(scoreExact).toBeGreaterThan(scoreStarts);
    expect(scoreStarts).toBeGreaterThan(scoreIncludes);
    expect(scoreIncludes).toBeGreaterThan(scoreNone);
  });
});

describe('Phase 6.1 — Input Safety & Escaping', () => {
  it('escapes reserved PostgREST characters (commas, parentheses, colons, dots, percents, underscores)', () => {
    const dangerousInput = 'محمد,علي (عقار) % _ : . \\';
    const escaped = escapePostgREST(dangerousInput);

    expect(escaped).not.toContain(' محمد,');
    expect(escaped).toContain('\\,');
    expect(escaped).toContain('\\(');
    expect(escaped).toContain('\\)');
    expect(escaped).toContain('\\:');
    expect(escaped).toContain('\\.');
    expect(escaped).toContain('\\%');
    expect(escaped).toContain('\\_');
    expect(escaped).toContain('\\\\');
  });

  it('submits correctly escaped PostgREST queries through the query builder', () => {
    const searchVal = 'محمد,علي';
    const escaped = escapePostgREST(searchVal);

    // Call the search logic
    const { result } = renderHook(() => useCommandSearch(searchVal));

    // Force queryFn execution to evaluate supabase query parameters
    if (lastQueryFn) {
      const controller = new AbortController();
      lastQueryFn({ signal: controller.signal });
    }

    // Verify the query builder was called with the properly escaped value
    expect(lastOrArgs['people']).toContain(escaped);
  });
});

describe('Phase 6.1 — Global Entity Search, Debounce & Cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryFnCounter = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not trigger entity search when search query length is less than 2', () => {
    const { result } = renderHook(() => useCommandSearch('ا'));
    expect(result.current.entities.length).toBe(0);
    expect(queryFnCounter).toBe(0);
  });

  it('proves debounce contract: throttles multiple fast keystrokes and only triggers once', () => {
    let searchVal = 'أ';
    const { rerender } = renderHook(() => useCommandSearch(searchVal));

    // Fast typing simulation:
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryFnCounter).toBe(0); // too short

    searchVal = 'أح';
    rerender();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryFnCounter).toBe(0); // within debounce window

    searchVal = 'أحم';
    rerender();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(queryFnCounter).toBe(0); // within debounce window

    searchVal = 'أحمد';
    rerender();
    act(() => {
      vi.advanceTimersByTime(200); // within debounce
    });
    expect(queryFnCounter).toBe(0);

    act(() => {
      vi.advanceTimersByTime(150); // debounce timeout (300ms completed)
    });
    expect(queryFnCounter).toBe(1); // executed exactly once!
  });
});

describe('Phase 6.1 — Nested Relation Contracts Search (PostgREST validation)', () => {
  it('correctly queries contracts nested relation properties and people with correct aliases', () => {
    const { result } = renderHook(() => useCommandSearch('عقد'));

    if (lastQueryFn) {
      const controller = new AbortController();
      lastQueryFn({ signal: controller.signal });
    }

    // Verify correct selection of relations
    expect(lastSelectArgs['contracts']).toContain('properties:properties!contracts_property_id_fkey!inner(title)');
    expect(lastSelectArgs['contracts']).toContain('people:people!contracts_tenant_id_fkey!inner(full_name)');
    // Verify the PostgREST nested or filtering argument is correct
    expect(lastOrArgs['contracts']).toContain('properties.title.ilike.%عقد%');
    expect(lastOrArgs['contracts']).toContain('people.full_name.ilike.%عقد%');
  });
});
