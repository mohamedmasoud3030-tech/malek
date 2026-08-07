// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Behavioral contract for CompanyProvider active-company resolution:
 * - Authorized active memberships are the source of truth for access.
 * - The JWT app_metadata.company_id claim (server-issued by the access-token
 *   hook) selects WHICH membership is active.
 * - Missing/stale claims are recovered by refresh, then by a server-side
 *   preference sync that is verified against the issued claim.
 * - Anything the server cannot verify fails closed — never a cosmetic bypass.
 */

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  updateUser: vi.fn(),
  sessionHolder: { current: null as { user: { id: string; app_metadata: Record<string, unknown> } } | null },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: {
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
      updateUser: mocks.updateUser,
    },
  },
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ session: mocks.sessionHolder.current, isLoading: false }),
}));

// Imported after the mocks so the provider sees the stubbed client.
const { CompanyProvider, useCompany, ACTIVE_COMPANY_ERROR } = await import('@/hooks/use-company');

type CompanyShape = { id: string; name: string; slug: string; currency: string; locale: string };

const COMPANY_A: CompanyShape = { id: 'company-a-uuid', name: 'شركة أ', slug: 'a', currency: 'OMR', locale: 'ar-OM' };
const COMPANY_B: CompanyShape = { id: 'company-b-uuid', name: 'شركة ب', slug: 'b', currency: 'OMR', locale: 'ar-OM' };
const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';

function makeSession(userId: string, claimCompanyId: string | null) {
  return {
    access_token: 'test-token',
    user: {
      id: userId,
      email: `${userId}@example.test`,
      app_metadata: claimCompanyId ? { company_id: claimCompanyId, user_role: 'ADMIN' } : { user_role: 'ADMIN' },
      user_metadata: {},
    },
  };
}

function membershipRow(company: CompanyShape, role: string) {
  return { company_id: company.id, role, companies: company };
}

type QueryResult = { data: unknown; error: unknown };

let membershipsResult: QueryResult = { data: [], error: null };
let roleResult: QueryResult = { data: { role: 'ADMIN' }, error: null };

/** Builds the fluent PostgREST chain stub used by CompanyProvider queries. */
function makeFromChain() {
  let orderCalls = 0;
  let mode: 'list' | 'role' = 'list';
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn((columns: string) => {
    mode = columns === 'role' ? 'role' : 'list';
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => {
    orderCalls += 1;
    return orderCalls >= 2 ? Promise.resolve(membershipsResult) : chain;
  });
  chain.single = vi.fn(() => Promise.resolve(mode === 'role' ? roleResult : membershipsResult));
  return chain;
}

let capturedContext: {
  activeCompany: CompanyShape | null;
  currentRole: string | null;
  companies: CompanyShape[];
  switchCompany: (companyId: string) => Promise<void>;
} | null = null;

function ContextProbe() {
  const ctx = useCompany();
  capturedContext = ctx;
  return (
    <div>
      <span data-testid="active">{ctx.activeCompany?.id ?? 'none'}</span>
      <span data-testid="role">{ctx.currentRole ?? 'none'}</span>
      <span data-testid="count">{ctx.companies.length}</span>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <CompanyProvider>
        <ContextProbe />
      </CompanyProvider>
    </QueryClientProvider>,
  );
  return { ...renderResult, queryClient };
}

function refreshReturns(claimCompanyId: string | null) {
  mocks.refreshSession.mockResolvedValue({
    data: { session: makeSession(USER_ID, claimCompanyId) },
    error: null,
  });
}

beforeEach(() => {
  membershipsResult = { data: [], error: null };
  roleResult = { data: { role: 'ADMIN' }, error: null };
  capturedContext = null;
  mocks.from.mockImplementation(() => makeFromChain());
  mocks.refreshSession.mockReset();
  mocks.updateUser.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
  mocks.getSession.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.from.mockReset();
});

describe('CompanyProvider resolution — single-company user', () => {
  it('opens immediately when the issued claim already matches the membership', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(screen.getByTestId('role')).toHaveTextContent('OWNER');
    expect(screen.queryByText(ACTIVE_COMPANY_ERROR)).not.toBeInTheDocument();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('recovers a stale cached token with one refresh and no preference write', async () => {
    // Session token was issued before the membership existed: no claim cached.
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };
    refreshReturns(COMPANY_A.id); // hook injects the claim on refresh

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('syncs the preference server-side and verifies the issued claim', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'MEMBER')], error: null };
    mocks.refreshSession
      .mockResolvedValueOnce({ data: { session: makeSession(USER_ID, null) }, error: null }) // still no claim
      .mockResolvedValueOnce({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null }); // after preference sync

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { company_id: COMPANY_A.id } });
    expect(screen.queryByText(ACTIVE_COMPANY_ERROR)).not.toBeInTheDocument();
  });
});

describe('CompanyProvider resolution — multi-company user', () => {
  it('honours the server claim when it picks the second membership', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_B.id);
    membershipsResult = {
      data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'VIEWER')],
      error: null,
    };

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_B.id));
    expect(screen.getByTestId('role')).toHaveTextContent('VIEWER');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('falls back to the deterministic membership default and syncs when the claim points to a company the user lost access to', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, 'revoked-company-uuid');
    membershipsResult = {
      data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'ADMIN')],
      error: null,
    };
    mocks.refreshSession
      .mockResolvedValueOnce({ data: { session: makeSession(USER_ID, 'revoked-company-uuid') }, error: null })
      .mockResolvedValueOnce({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { company_id: COMPANY_A.id } });
  });

  it('switches companies through preference sync with server verification', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = {
      data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'ADMIN')],
      error: null,
    };
    roleResult = { data: { role: 'ADMIN' }, error: null };
    mocks.getSession.mockResolvedValue({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null });
    refreshReturns(COMPANY_B.id);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));

    await act(async () => {
      await capturedContext!.switchCompany(COMPANY_B.id);
    });

    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { company_id: COMPANY_B.id } });
    expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_B.id);
    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN');
    expect(screen.queryByText(ACTIVE_COMPANY_ERROR)).not.toBeInTheDocument();
  });

  it('switchCompany fails closed when the server refuses to issue the requested claim', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = {
      data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'ADMIN')],
      error: null,
    };
    mocks.getSession.mockResolvedValue({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null });
    refreshReturns(COMPANY_A.id); // server keeps issuing the previous company

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));

    let switchError: unknown = null;
    await act(async () => {
      try {
        await capturedContext!.switchCompany(COMPANY_B.id);
      } catch (error) {
        switchError = error;
      }
    });
    expect(switchError).toBeInstanceOf(Error);
    expect((switchError as Error).message).toBe(ACTIVE_COMPANY_ERROR);

    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
    // No cosmetic switch: the company context is unmounted behind the
    // fail-closed screen instead of exposing a half-switched tenant.
    expect(screen.queryByTestId('active')).not.toBeInTheDocument();
  });
});

describe('CompanyProvider fail-closed behavior', () => {
  it('fails closed when the user has no active membership', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [], error: null };

    renderProvider();

    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(capturedContext).toBeNull();
  });

  it('fails closed when the membership query errors', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: null, error: { message: 'db down' } };

    renderProvider();

    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
  });

  it('fails closed when the server never issues a claim matching the membership (hook not honoring preferences)', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };
    mocks.refreshSession.mockResolvedValue({
      data: { session: makeSession(USER_ID, 'unrelated-company-uuid') },
      error: null,
    });

    renderProvider();

    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
    // The provider attempted the proper server-side sync and still refused
    // to render outside the verified JWT claim.
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { company_id: COMPANY_A.id } });
    expect(capturedContext).toBeNull();
  });

  it('recovers after sign-out/sign-in user change without leaking the previous tenant', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };

    const { rerender, queryClient } = renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));

    // Sign out.
    mocks.sessionHolder.current = null;
    rerender(
      <QueryClientProvider client={queryClient}>
        <CompanyProvider>
          <ContextProbe />
        </CompanyProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));

    // Sign in as another user whose membership resolves to company B only.
    mocks.sessionHolder.current = makeSession(OTHER_USER_ID, COMPANY_B.id);
    membershipsResult = { data: [membershipRow(COMPANY_B, 'MEMBER')], error: null };
    rerender(
      <QueryClientProvider client={queryClient}>
        <CompanyProvider>
          <ContextProbe />
        </CompanyProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_B.id));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.queryByText(ACTIVE_COMPANY_ERROR)).not.toBeInTheDocument();
  });
});
