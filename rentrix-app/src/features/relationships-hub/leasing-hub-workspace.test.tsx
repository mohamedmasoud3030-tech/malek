// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let allowedPermissions = new Set<string>(['leads.view', 'communication.view']);

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ canAccess: (permission: string) => allowedPermissions.has(permission) }) }));

function makeProbe(name: string) {
  return function Probe({ embedded }: { embedded?: boolean }) {
    const [count, setCount] = useState(0);
    return (
      <div>
        <span data-testid={`${name}-body`}>{name} body</span>
        <span data-testid={`${name}-embedded`}>{embedded ? 'yes' : 'no'}</span>
        <span data-testid={`${name}-count`}>{count}</span>
        <button type="button" data-testid={`${name}-increment`} onClick={() => setCount((value) => value + 1)}>inc</button>
      </div>
    );
  };
}

vi.mock('@/features/contracts/ContractsListPage', () => ({ ContractsWorkspace: makeProbe('contracts') }));
vi.mock('@/features/tenants/TenantsPage', () => ({ TenantsWorkspace: makeProbe('tenants') }));
vi.mock('@/features/people/people-list-page', () => ({ PeopleListPage: makeProbe('people') }));
vi.mock('@/features/leads/leads-page', () => ({ LeadsWorkspace: makeProbe('leads') }));
vi.mock('@/features/communication/communication-page', () => ({ CommunicationWorkspace: makeProbe('communication') }));

const { LeasingHubWorkspace } = await import('./leasing-hub-workspace');

function renderHub({ initialUrl = '/contracts', permissions = ['leads.view', 'communication.view'] } = {}) {
  allowedPermissions = new Set(permissions);
  const rootRoute = createRootRoute();
  const hubRoute = createRoute({ getParentRoute: () => rootRoute, path: '/contracts', component: LeasingHubWorkspace, validateSearch: (search: Record<string, unknown>) => search });
  const router = createRouter({ routeTree: rootRoute.addChildren([hubRoute]), history: createMemoryHistory({ initialEntries: [initialUrl] }) });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </QueryClientProvider>,
  );
  return { ...utils, router };
}

beforeEach(() => { allowedPermissions = new Set(['leads.view', 'communication.view']); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Leasing workspace', () => {
  it('renders one shell titled التأجير with contracts as the default journey', async () => {
    const { container } = renderHub();
    expect((await screen.findByTestId('contracts-embedded')).textContent).toBe('yes');
    expect(screen.getByText('التأجير')).toBeTruthy();
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
  });

  it('switches tenant, people, lead and communication capabilities in place', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('contracts-body');
    for (const [name, workspace, probe] of [
      [/المستأجرون/, 'tenants', 'tenants'],
      [/جهات التعامل/, 'people', 'people'],
      [/العملاء المحتملون/, 'leads', 'leads'],
      [/التواصل/, 'communication', 'communication'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/contracts'));
      await waitFor(() => expect(router.state.location.search).toMatchObject({ workspace }));
      expect((await screen.findByTestId(`${probe}-embedded`)).textContent).toBe('yes');
    }
  });

  it('opens a Leasing deep link without leaving /contracts', async () => {
    const { router } = renderHub({ initialUrl: '/contracts?workspace=people' });
    expect((await screen.findByTestId('people-embedded')).textContent).toBe('yes');
    expect(router.state.location.pathname).toBe('/contracts');
    expect(router.state.location.search).toMatchObject({ workspace: 'people' });
  });

  it('hides permissioned lead and communication sections when access is absent', async () => {
    renderHub({ permissions: [] });
    await screen.findByTestId('contracts-body');
    const labels = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '').join(' ');
    expect(labels).toContain('العقود');
    expect(labels).toContain('المستأجرون');
    expect(labels).toContain('جهات التعامل');
    expect(labels).not.toContain('العملاء المحتملون');
    expect(labels).not.toContain('التواصل');
  });

  it('fails closed on a forbidden permissioned deep link', async () => {
    renderHub({ initialUrl: '/contracts?workspace=leads', permissions: [] });
    expect(await screen.findByText('ليس لديك صلاحية لعرض هذا القسم من التأجير.')).toBeTruthy();
    expect(screen.queryByTestId('leads-body')).toBeNull();
  });

  it('preserves local section state across workspace switches', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId('contracts-body');
    await user.click(screen.getByTestId('contracts-increment'));
    expect(screen.getByTestId('contracts-count').textContent).toBe('1');
    await user.click(screen.getByRole('tab', { name: /المستأجرون/ }));
    await screen.findByTestId('tenants-body');
    await user.click(screen.getByRole('tab', { name: /العقود/ }));
    expect((await screen.findByTestId('contracts-count')).textContent).toBe('1');
  });
});
