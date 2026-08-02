// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext, AuthorizationRole } from '@/features/auth/permissions';

let currentRole: AuthorizationRole | null = 'ADMIN';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: currentRole
      ? ({ userId: `user-${currentRole}`, email: 'user@example.com', role: currentRole } satisfies AuthorizationContext)
      : null,
    canAccess: () => true,
  }),
}));

function makeProbe(name: string) {
  return function Probe({ embedded }: { embedded?: boolean }) {
    const [count, setCount] = useState(0);
    return (
      <div>
        <span data-testid={`${name}-body`}>{name} body</span>
        <span data-testid={`${name}-embedded`}>{embedded ? 'yes' : 'no'}</span>
        <span data-testid={`${name}-count`}>{count}</span>
        <button type="button" data-testid={`${name}-increment`} onClick={() => setCount((v) => v + 1)}>
          inc
        </button>
      </div>
    );
  };
}

vi.mock('@/features/contracts/ContractsListPage', () => ({ ContractsWorkspace: makeProbe('contracts') }));
vi.mock('@/features/people/people-list-page', () => ({ PeopleWorkspace: makeProbe('people') }));
vi.mock('@/features/tenants/TenantsPage', () => ({ TenantsWorkspace: makeProbe('tenants') }));
vi.mock('@/features/leads/leads-page', () => ({ LeadsWorkspace: makeProbe('leads') }));
vi.mock('@/features/communication/communication-page', () => ({ CommunicationWorkspace: makeProbe('communication') }));

const { RelationshipsHubWorkspace } = await import('./relationships-hub-workspace');

function renderHub({
  initialUrl = '/contracts',
  role = 'ADMIN' as AuthorizationRole | null,
} = {}) {
  currentRole = role;
  const rootRoute = createRootRoute();
  const hubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/contracts',
    component: () => <RelationshipsHubWorkspace />,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([hubRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </QueryClientProvider>,
  );
  return { ...utils, router };
}

beforeEach(() => { currentRole = 'ADMIN'; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('relationships hub', () => {
  it('renders a single page shell', async () => {
    const { container } = renderHub();
    await screen.findByTestId('contracts-body');
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
  });

  it('embeds child workspaces', async () => {
    renderHub();
    expect((await screen.findByTestId('contracts-embedded')).textContent).toBe('yes');
  });

  it('syncs tab clicks to the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('contracts-body');
    await user.click(screen.getByRole('tab', { name: /الأشخاص/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ section: 'people' }));
    expect(await screen.findByTestId('people-body')).toBeTruthy();
  });

  it('opens a deep-linked section', async () => {
    renderHub({ initialUrl: '/contracts?section=tenants' });
    expect(await screen.findByTestId('tenants-body')).toBeTruthy();
  });

  it('preserves state across tab switches', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId('contracts-body');
    await user.click(screen.getByTestId('contracts-increment'));
    expect(screen.getByTestId('contracts-count').textContent).toBe('1');
    await user.click(screen.getByRole('tab', { name: /المستأجرون/ }));
    await screen.findByTestId('tenants-body');
    await user.click(screen.getByRole('tab', { name: /العقود/ }));
    await screen.findByTestId('contracts-body');
    expect(screen.getByTestId('contracts-count').textContent).toBe('1');
  });

  it('hides permission-gated tabs for USER', async () => {
    renderHub({ role: 'USER' });
    await screen.findByTestId('contracts-body');
    const names = screen.getAllByRole('tab').map((t) => t.textContent ?? '').join(' ');
    expect(names).toContain('العقود');
    expect(names).toContain('الأشخاص');
    expect(names).toContain('المستأجرون');
    expect(names).not.toContain('العملاء المحتملون');
    expect(names).not.toContain('التواصل');
  });

  it('denies forbidden deep links', async () => {
    renderHub({ initialUrl: '/contracts?section=leads', role: 'USER' });
    expect(await screen.findByText(/غير مصرح بالوصول/)).toBeTruthy();
    expect(screen.queryByTestId('leads-body')).toBeNull();
  });

  it('never duplicates the shell after tab switches', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('contracts-body');
    for (const name of [/الأشخاص/, /المستأجرون/, /العملاء المحتملون/, /التواصل/, /العقود/]) {
      await user.click(screen.getByRole('tab', { name }));
      await waitFor(() => {
        expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
        expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
      });
    }
  });
});
