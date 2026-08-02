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

vi.mock('@/features/properties/properties-list-page', () => ({ PropertiesWorkspace: makeProbe('properties') }));
vi.mock('@/features/owners/OwnersPage', () => ({ OwnersWorkspace: makeProbe('owners') }));
vi.mock('@/features/units/units-page', () => ({ UnitsWorkspace: makeProbe('units') }));
vi.mock('@/features/lands/lands-page', () => ({ LandsWorkspace: makeProbe('lands') }));

const { PortfolioHubWorkspace } = await import('./portfolio-hub-workspace');

function renderHub({
  initialUrl = '/properties',
  role = 'ADMIN' as AuthorizationRole | null,
  mode = 'standalone' as 'standalone' | 'embedded',
} = {}) {
  currentRole = role;
  const rootRoute = createRootRoute();
  const hubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/properties',
    component: () => <PortfolioHubWorkspace mode={mode} />,
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

describe('portfolio hub', () => {
  it('renders a single page shell', async () => {
    const { container } = renderHub();
    await screen.findByTestId('properties-body');
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
  });

  it('embeds child workspaces', async () => {
    renderHub();
    expect((await screen.findByTestId('properties-embedded')).textContent).toBe('yes');
  });

  it('omits its own page shell in embedded mode', async () => {
    const { container } = renderHub({ mode: 'embedded' });
    await screen.findByTestId('properties-body');
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(0);
  });

  it('syncs tab clicks to the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('properties-body');
    await user.click(screen.getByRole('tab', { name: /الوحدات/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ section: 'units' }));
    expect(await screen.findByTestId('units-body')).toBeTruthy();
  });

  it('opens a deep-linked section', async () => {
    renderHub({ initialUrl: '/properties?section=owners' });
    expect(await screen.findByTestId('owners-body')).toBeTruthy();
  });

  it('preserves state across tab switches', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId('properties-body');
    await user.click(screen.getByTestId('properties-increment'));
    expect(screen.getByTestId('properties-count').textContent).toBe('1');
    await user.click(screen.getByRole('tab', { name: /الوحدات/ }));
    await screen.findByTestId('units-body');
    await user.click(screen.getByRole('tab', { name: /العقارات/ }));
    await screen.findByTestId('properties-body');
    expect(screen.getByTestId('properties-count').textContent).toBe('1');
  });

  it('hides permission-gated tabs for USER', async () => {
    renderHub({ role: 'USER' });
    await screen.findByTestId('properties-body');
    const names = screen.getAllByRole('tab').map((t) => t.textContent ?? '').join(' ');
    expect(names).toContain('العقارات');
    expect(names).toContain('الوحدات');
    expect(names).not.toContain('الملاك');
    expect(names).not.toContain('الأراضي');
  });

  it('denies forbidden deep links', async () => {
    renderHub({ initialUrl: '/properties?section=lands', role: 'USER' });
    expect(await screen.findByText(/غير مصرح بالوصول/)).toBeTruthy();
    expect(screen.queryByTestId('lands-body')).toBeNull();
  });

  it('never duplicates the shell after tab switches', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('properties-body');
    for (const name of [/الملاك/, /الوحدات/, /الأراضي/, /العقارات/]) {
      await user.click(screen.getByRole('tab', { name }));
      await waitFor(() => {
        expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
        expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
      });
    }
  });
});
