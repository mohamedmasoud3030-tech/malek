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
  return function Probe(props: { mode?: string; embedded?: boolean }) {
    const [count, setCount] = useState(0);
    const embedded = props.mode === 'embedded' || props.embedded === true;
    return (
      <div>
        <span data-testid={`${name}-body`}>{name} body</span>
        <span data-testid={`${name}-embedded`}>{embedded ? 'yes' : 'no'}</span>
        <span data-testid={`${name}-count`}>{count}</span>
        <button type="button" data-testid={`${name}-increment`} onClick={() => setCount((value) => value + 1)}>increment</button>
      </div>
    );
  };
}

vi.mock('@/features/maintenance/components/maintenance-workspace', () => ({ MaintenanceWorkspace: makeProbe('maintenance') }));
vi.mock('@/features/service-providers/service-providers-page', () => ({ ServiceProvidersWorkspace: makeProbe('service-providers') }));
vi.mock('@/features/utilities/components/utilities-workspace', () => ({ UtilitiesWorkspace: makeProbe('utilities') }));
vi.mock('@/features/documents-vault/components/documents-vault-workspace', () => ({ DocumentsVaultWorkspace: makeProbe('documents-vault') }));

const { OperationsHubWorkspace } = await import('./operations-hub-workspace');

type RenderOptions = Readonly<{
  initialUrl?: string;
  role?: AuthorizationRole | null;
  mode?: 'standalone' | 'embedded';
}>;

function renderServices({ initialUrl = '/maintenance', role = 'ADMIN', mode = 'standalone' }: RenderOptions = {}) {
  currentRole = role;
  const rootRoute = createRootRoute();
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/maintenance',
    component: () => <OperationsHubWorkspace defaultSection="maintenance" mode={mode} />,
    validateSearch: (search: Record<string, unknown>) => search,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
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

describe('Services workspace', () => {
  it('renders one shell titled الخدمات with four operational tabs', async () => {
    const { container } = renderServices();
    await screen.findByTestId('maintenance-body');
    expect(container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-page-header]')).toHaveLength(1);
    expect(screen.getByText('الخدمات')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.queryByRole('tab', { name: /الأتمتة/ })).toBeNull();
  });

  it('keeps every service capability in /maintenance with section state', async () => {
    const user = userEvent.setup();
    const { router } = renderServices();
    await screen.findByTestId('maintenance-body');

    for (const [label, section, probe] of [
      [/مزودو الخدمات/, 'service_providers', 'service-providers'],
      [/المرافق والعدادات/, 'utilities', 'utilities'],
      [/المستندات التشغيلية/, 'documents_vault', 'documents-vault'],
    ] as const) {
      await user.click(screen.getByRole('tab', { name: label }));
      await waitFor(() => expect(router.state.location.pathname).toBe('/maintenance'));
      await waitFor(() => expect(router.state.location.search).toMatchObject({ section }));
      expect((await screen.findByTestId(`${probe}-embedded`)).textContent).toBe('yes');
    }
  });

  it('opens valid deep links in place and treats old automation section as retired', async () => {
    const valid = renderServices({ initialUrl: '/maintenance?section=documents_vault' });
    expect(await screen.findByTestId('documents-vault-body')).toBeTruthy();
    valid.unmount();

    const retired = renderServices({ initialUrl: '/maintenance?section=automation' });
    expect(await screen.findByTestId('maintenance-body')).toBeTruthy();
    expect(screen.queryByTestId('automation-body')).toBeNull();
    retired.unmount();
  });

  it('preserves local state across service switches', async () => {
    const user = userEvent.setup();
    renderServices();
    await screen.findByTestId('maintenance-body');
    await user.click(screen.getByTestId('maintenance-increment'));
    await user.click(screen.getByRole('tab', { name: /المرافق والعدادات/ }));
    await screen.findByTestId('utilities-body');
    await user.click(screen.getByRole('tab', { name: /الصيانة/ }));
    expect(screen.getByTestId('maintenance-count').textContent).toBe('1');
  });

  it('hides permissioned sections for USER while preserving authenticated-only services', async () => {
    renderServices({ role: 'USER' });
    await screen.findByTestId('utilities-body');
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '').join(' ');
    expect(names).toContain('المرافق');
    expect(names).toContain('المستندات');
    expect(names).not.toContain('الصيانة');
    expect(names).not.toContain('مزودو الخدمات');
  });

  it('fails closed for a forbidden real Services deep link', async () => {
    renderServices({ initialUrl: '/maintenance?section=maintenance', role: 'USER' });
    expect(await screen.findByText(/غير مصرح بالوصول/)).toBeTruthy();
    expect(screen.queryByTestId('maintenance-body')).toBeNull();
  });

  it('omits its shell when embedded and never duplicates it after navigation', async () => {
    const embedded = renderServices({ mode: 'embedded' });
    await screen.findByTestId('maintenance-body');
    expect(embedded.container.querySelectorAll('[data-page-layout]')).toHaveLength(0);
    embedded.unmount();

    const user = userEvent.setup();
    const standalone = renderServices();
    await screen.findByTestId('maintenance-body');
    for (const label of [/مزودو الخدمات/, /المرافق والعدادات/, /الصيانة/]) {
      await user.click(screen.getByRole('tab', { name: label }));
      await waitFor(() => {
        expect(standalone.container.querySelectorAll('[data-page-layout]')).toHaveLength(1);
        expect(standalone.container.querySelectorAll('[data-page-header]')).toHaveLength(1);
      });
    }
  });
});
