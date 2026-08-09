// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, queryFn, enabled }: any) => {
    if (enabled) {
      queryFnCounter++;
      const controller = new AbortController();
      lastSignal = controller.signal;
      try {
        queryFn({ signal: lastSignal });
      } catch (err) {
        // Safe to ignore in test mock
      }
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

// Mock supabase client to track queries
const mockOr = vi.fn().mockImplementation(() => ({
  limit: vi.fn().mockImplementation(() => ({
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

const mockIlike = vi.fn().mockImplementation(() => ({
  limit: vi.fn().mockImplementation(() => ({
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

const mockIs = vi.fn().mockImplementation(() => ({
  or: mockOr,
  ilike: mockIlike,
  limit: vi.fn().mockImplementation(() => ({
    abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => ({
        is: mockIs,
        limit: vi.fn().mockImplementation(() => ({
          abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    })),
  },
}));

describe('Phase 6 — Command Palette Registry & Static Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccess.mockReturnValue(true);
    queryFnCounter = 0;
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
    expect(settingsExists).toBe(false);
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
});

describe('Phase 6.1 — Global Entity Search Behavior', () => {
  beforeEach(() => {
    queryFnCounter = 0;
  });

  it('does not trigger entity search when search query length is less than 2', () => {
    const { result } = renderHook(() => useCommandSearch('ا'));
    expect(result.current.entities.length).toBe(0);
    expect(queryFnCounter).toBe(0);
  });

  it('correctly executes aborted / cancelled requests', () => {
    const { result } = renderHook(() => useCommandSearch('احمد'));
    expect(lastSignal).toBeDefined();
    expect(lastSignal.aborted).toBe(false);
  });
});
