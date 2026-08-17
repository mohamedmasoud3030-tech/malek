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
vi.mock('@/features/units/units-page', () => ({ UnitsWorkspace: makeProbe('units') }));
vi.mock('@/features/lands/lands-page', () => ({ LandsWorkspace: makeProbe('lands') }));
vi.mock('@/features/owners/OwnersPage', () => ({ OwnersWorkspace: makeProbe('owners') }));

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

describe('Portfolio workspace', () => {
  it('renders one shell titled المحفظة', async () => {
    const { container } = renderHub();
    await screen.findByTestId('properties-body');
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
    expect(screen.getByText('المحفظة')).toBeTruthy();
  });

  it('embeds every managed-asset capability instead of navigating to another product', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('properties-body');

    for (const [tabName, section, probe] of [
      [/الوحدات/, 'units', 'units'],
      [/الأراضي/, 'lands', 'lands'],
      [/الملاك/, 'owners', 'owners'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: tabName }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/properties'));
      await waitFor(() => expect(router.state.location.search).toMatchObject({ section }));
      expect((await screen.findByTestId(`${probe}-embedded`)).textContent).toBe('yes');
    }
  });

  it('opens deep-linked Portfolio sections in place', async () => {
    const { router } = renderHub({ initialUrl: '/properties?section=owners' });
    expect((await screen.findByTestId('owners-embedded')).textContent).toBe('yes');
    expect(router.state.location.pathname).toBe('/properties');
    expect(router.state.location.search).toMatchObject({ section: 'owners' });
  });

  it('keeps permissioned asset sections hidden from USER', async () => {
    renderHub({ role: 'USER' });
    await screen.findByTestId('properties-body');
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '').join(' ');
    expect(names).toContain('العقارات');
    expect(names).toContain('الوحدات');
    expect(names).not.toContain('الأراضي');
    expect(names).not.toContain('الملاك');
  });

  it('fails closed when a USER deep-links a forbidden Portfolio section', async () => {
    renderHub({ initialUrl: '/properties?section=owners', role: 'USER' });
    expect(await screen.findByText('ليس لديك صلاحية لعرض هذا القسم من المحفظة.')).toBeTruthy();
    expect(screen.queryByTestId('owners-body')).toBeNull();
  });

  it('preserves state across Portfolio tab switches', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId('properties-body');
    await user.click(screen.getByTestId('properties-increment'));
    expect(screen.getByTestId('properties-count').textContent).toBe('1');
    await user.click(screen.getByRole('tab', { name: /الملاك/ }));
    await screen.findByTestId('owners-body');
    await user.click(screen.getByRole('tab', { name: /العقارات/ }));
    await screen.findByTestId('properties-body');
    expect(screen.getByTestId('properties-count').textContent).toBe('1');
  });

  it('omits its own page shell in embedded mode', async () => {
    const { container } = renderHub({ mode: 'embedded' });
    await screen.findByTestId('properties-body');
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(0);
  });

  it('never duplicates the shell after moving across all Portfolio sections', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('properties-body');
    for (const name of [/الوحدات/, /الأراضي/, /الملاك/, /العقارات/]) {
      await user.click(screen.getByRole('tab', { name }));
      await waitFor(() => {
        expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
        expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
      });
    }
  });
});
