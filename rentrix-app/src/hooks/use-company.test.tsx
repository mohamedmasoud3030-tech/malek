// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

describe('CompanyProvider resolution', () => {
  it('opens immediately when the issued claim matches the membership', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(screen.getByTestId('role')).toHaveTextContent('OWNER');
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('recovers a stale cached token with one refresh', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };
    refreshReturns(COMPANY_A.id);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('syncs a deterministic membership preference and verifies the issued claim', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'MEMBER')], error: null };
    mocks.refreshSession
      .mockResolvedValueOnce({ data: { session: makeSession(USER_ID, null) }, error: null })
      .mockResolvedValueOnce({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { company_id: COMPANY_A.id } });
  });

  it('honours the server claim for a second membership', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_B.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'VIEWER')], error: null };
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_B.id));
    expect(screen.getByTestId('role')).toHaveTextContent('VIEWER');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('switches companies only after server claim verification', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'ADMIN')], error: null };
    roleResult = { data: { role: 'ADMIN' }, error: null };
    mocks.getSession.mockResolvedValue({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null });
    refreshReturns(COMPANY_B.id);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    await act(async () => { await capturedContext!.switchCompany(COMPANY_B.id); });
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { company_id: COMPANY_B.id } });
    expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_B.id);
    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN');
  });

  it('fails closed when the server refuses the requested switch claim', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER'), membershipRow(COMPANY_B, 'ADMIN')], error: null };
    mocks.getSession.mockResolvedValue({ data: { session: makeSession(USER_ID, COMPANY_A.id) }, error: null });
    refreshReturns(COMPANY_A.id);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));
    let switchError: unknown = null;
    await act(async () => {
      try { await capturedContext!.switchCompany(COMPANY_B.id); } catch (error) { switchError = error; }
    });
    expect(switchError).toBeInstanceOf(Error);
    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
    expect(screen.queryByTestId('active')).not.toBeInTheDocument();
  });

  it('fails closed when no active membership exists', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, null);
    membershipsResult = { data: [], error: null };
    renderProvider();
    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
    expect(capturedContext).toBeNull();
  });

  it('fails closed when the membership query errors', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: null, error: { message: 'db down' } };
    renderProvider();
    await waitFor(() => expect(screen.getByText(ACTIVE_COMPANY_ERROR)).toBeInTheDocument());
  });

  it('recovers across logout/login user changes without leaking tenant context', async () => {
    mocks.sessionHolder.current = makeSession(USER_ID, COMPANY_A.id);
    membershipsResult = { data: [membershipRow(COMPANY_A, 'OWNER')], error: null };
    const { rerender, queryClient } = renderProvider();
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_A.id));

    mocks.sessionHolder.current = null;
    rerender(
      <QueryClientProvider client={queryClient}>
        <CompanyProvider><ContextProbe /></CompanyProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('none'));

    mocks.sessionHolder.current = makeSession(OTHER_USER_ID, COMPANY_B.id);
    membershipsResult = { data: [membershipRow(COMPANY_B, 'MEMBER')], error: null };
    rerender(
      <QueryClientProvider client={queryClient}>
        <CompanyProvider><ContextProbe /></CompanyProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent(COMPANY_B.id));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });
});
