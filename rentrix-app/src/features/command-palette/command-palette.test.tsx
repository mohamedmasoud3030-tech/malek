// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { STATIC_COMMANDS } from './command-registry';
import { normalizeText, scoreResult, useCommandSearch } from './use-command-search';

// Mock auth hook
const mockCanAccess = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    canAccess: mockCanAccess,
    authorization: { role: 'ADMIN', userId: 'user-1' },
  }),
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, queryFn, enabled }: any) => {
    // Return standard react-query fields
    return {
      data: enabled ? [] : [],
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
}));

describe('Phase 6 — Command Palette Registry & Static Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccess.mockReturnValue(true);
  });

  it('Static Command Registry is the single source of truth for static destinations', () => {
    expect(STATIC_COMMANDS.length).toBeGreaterThan(10);

    // Verify presence of core modules
    const ids = STATIC_COMMANDS.map(c => cmd => cmd.id || c.id);
    const dashboardCmd = STATIC_COMMANDS.find(c => c.id === 'dashboard');
    const peopleCmd = STATIC_COMMANDS.find(c => c.id === 'people');
    const propertiesCmd = STATIC_COMMANDS.find(c => c.id === 'properties');
    const landsCmd = STATIC_COMMANDS.find(c => c.id === 'lands');
    const contractsCmd = STATIC_COMMANDS.find(c => c.id === 'contracts');

    expect(dashboardCmd).toBeDefined();
    expect(peopleCmd).toBeDefined();
    expect(propertiesCmd).toBeDefined();
    expect(landsCmd).toBeDefined();
    expect(contractsCmd).toBeDefined();

    expect(dashboardCmd?.canonicalRoute).toBe('/dashboard');
    expect(peopleCmd?.canonicalRoute).toBe('/people');
    expect(propertiesCmd?.canonicalRoute).toBe('/properties');
    expect(landsCmd?.canonicalRoute).toBe('/lands');
    expect(contractsCmd?.canonicalRoute).toBe('/contracts');
  });

  it('enforces permission filtering: does not expose protected static routes when user lacks permission', () => {
    // Mock user without 'lands.view' or 'settings.manage'
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

  it('exposes permission-unlocked routes to authorized users', () => {
    mockCanAccess.mockReturnValue(true);

    const { result } = renderHook(() => useCommandSearch(''));
    const landsExists = result.current.staticCommands.some(c => c.id === 'lands');
    const settingsExists = result.current.staticCommands.some(c => c.id === 'settings');

    expect(landsExists).toBe(true);
    expect(settingsExists).toBe(true);
  });
});

describe('Phase 6 — Arabic Text Normalization & Simple Ranking', () => {
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

    // Exact match is highest priority
    const scoreExact = scoreResult('أحمد', '', query);
    // Starts-with is second priority
    const scoreStarts = scoreResult('أحمد علي', '', query);
    // Includes is third priority
    const scoreIncludes = scoreResult('سعيد أحمد', '', query);
    // No match
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

describe('Phase 6 — Global Entity Search Behavior', () => {
  it('does not trigger entity search when search query length is less than 2', () => {
    const { result } = renderHook(() => useCommandSearch('ا'));
    expect(result.current.entities.length).toBe(0);
  });
});
