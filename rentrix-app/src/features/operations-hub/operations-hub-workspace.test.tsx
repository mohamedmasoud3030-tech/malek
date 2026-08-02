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
  return function Probe({ mode }: { mode?: string }) {
    const [count, setCount] = useState(0);
    return (
      <div>
        <span data-testid={`${name}-body`}>{name} body</span>
        <span data-testid={`${name}-mode`}>{mode ?? 'standalone'}</span>
        <span data-testid={`${name}-count`}>{count}</span>
        <button type="button" data-testid={`${name}-increment`} onClick={() => setCount((value) => value + 1)}>
          increment {name}
        </button>
      </div>
    );
  };
}

vi.mock('@/features/maintenance/components/maintenance-workspace', () => ({ MaintenanceWorkspace: makeProbe('maintenance') }));
vi.mock('@/features/utilities/components/utilities-workspace', () => ({ UtilitiesWorkspace: makeProbe('utilities') }));
vi.mock('@/features/automation/components/automation-workspace', () => ({ AutomationWorkspace: makeProbe('automation') }));
vi.mock('@/features/documents-vault/components/documents-vault-workspace', () => ({ DocumentsVaultWorkspace: makeProbe('documents_vault') }));

const { OperationsHubWorkspace } = await import('./operations-hub-workspace');

type RenderOptions = Readonly<{
  initialUrl?: string;
  role?: AuthorizationRole | null;
  defaultSection?: 'maintenance' | 'utilities' | 'automation' | 'documents_vault';
  mode?: 'standalone' | 'embedded';
}>;

function renderHub({
  initialUrl = '/maintenance',
  role = 'ADMIN',
  defaultSection = 'maintenance',
  mode = 'standalone',
}: RenderOptions = {}) {
  currentRole = role;

  const rootRoute = createRootRoute();
  const hubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/maintenance',
    component: () => (
      <OperationsHubWorkspace
        defaultSection={defaultSection}
        title="مركز التشغيل"
        description="وصف تجريبي"
        mode={mode}
      />
    ),
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

function pageLayoutCount(container: HTMLElement) {
  return container.querySelectorAll('[data-page-layout]').length;
}

function pageHeaderCount(container: HTMLElement) {
  return container.querySelectorAll('[data-page-header]').length;
}

beforeEach(() => {
  currentRole = 'ADMIN';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('operations hub — standalone rendering', () => {
  it('renders the shared page shell exactly once', async () => {
    const { container } = renderHub();
    await screen.findByTestId('maintenance-body');
    expect(pageLayoutCount(container)).toBe(1);
    expect(pageHeaderCount(container)).toBe(1);
  });

  it('shows the entry page default section when the URL requests nothing', async () => {
    renderHub({ initialUrl: '/maintenance' });
    expect(await screen.findByTestId('maintenance-body')).toBeTruthy();
  });

  it('renders the tab bar with one tab per permitted section', async () => {
    renderHub();
    await screen.findByTestId('maintenance-body');
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('embeds child workspaces in embedded mode', async () => {
    renderHub();
    expect((await screen.findByTestId('maintenance-mode')).textContent).toBe('embedded');
  });

  it('omits its own page shell when embedded in another workspace', async () => {
    const { container } = renderHub({ mode: 'embedded' });
    await screen.findByTestId('maintenance-body');

    expect(pageLayoutCount(container)).toBe(0);
    expect(pageHeaderCount(container)).toBe(0);
  });
});

describe('operations hub — URL synchronisation and deep linking', () => {
  it('opens the section named in the URL instead of the entry default', async () => {
    renderHub({ initialUrl: '/maintenance?section=utilities' });
    expect(await screen.findByTestId('utilities-body')).toBeTruthy();
  });

  it('writes the active section into the URL when a tab is clicked', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('maintenance-body');

    await user.click(screen.getByRole('tab', { name: /المرافق والعدادات/ }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ section: 'utilities' });
    });
    expect(await screen.findByTestId('utilities-body')).toBeTruthy();
  });

  it('replaces history when switching tabs so Back leaves the hub', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('maintenance-body');

    const lengthBefore = router.history.length;
    await user.click(screen.getByRole('tab', { name: /المرافق والعدادات/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ section: 'utilities' }));

    expect(router.history.length).toBe(lengthBefore);
  });

  it('falls back to the default section for an unknown section value', async () => {
    renderHub({ initialUrl: '/maintenance?section=not-a-real-section' });
    expect(await screen.findByTestId('maintenance-body')).toBeTruthy();
  });
});

describe('operations hub — state preservation across tab switches', () => {
  it('keeps a visited section mounted so its state survives a round trip', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId('maintenance-body');

    await user.click(screen.getByTestId('maintenance-increment'));
    await user.click(screen.getByTestId('maintenance-increment'));
    expect(screen.getByTestId('maintenance-count').textContent).toBe('2');

    await user.click(screen.getByRole('tab', { name: /المرافق والعدادات/ }));
    expect(await screen.findByTestId('utilities-body')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /الصيانة/ }));
    await screen.findByTestId('maintenance-body');

    expect(screen.getByTestId('maintenance-count').textContent).toBe('2');
  });

  it('does not mount a section before it is visited (lazy loading)', async () => {
    const { container } = renderHub();
    await screen.findByTestId('maintenance-body');

    expect(container.querySelector('[data-operations-section="automation"]')).toBeNull();
    expect(screen.queryByTestId('automation-body')).toBeNull();
  });
});

describe('operations hub — permission filtering', () => {
  it('hides tabs a USER may not open', async () => {
    renderHub({ role: 'USER' });
    await screen.findByTestId('utilities-body');

    const tabNames = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
    expect(tabNames.join(' ')).toContain('المرافق');
    expect(tabNames.join(' ')).toContain('خزينة');
    expect(tabNames.join(' ')).not.toContain('الصيانة');
    expect(tabNames.join(' ')).not.toContain('الأتمتة');
  });

  it('refuses a deep link to a section the user may not see', async () => {
    renderHub({ initialUrl: '/maintenance?section=automation', role: 'USER' });

    expect(await screen.findByText(/غير مصرح بالوصول/)).toBeTruthy();
    expect(screen.queryByTestId('automation-body')).toBeNull();
  });

  it('denies the whole workspace when there is no authorization context', async () => {
    renderHub({ role: null });

    expect(await screen.findByText(/غير مصرح بالوصول/)).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('keeps the page shell intact on the access-denied path', async () => {
    const { container } = renderHub({ role: null });
    await screen.findByText(/غير مصرح بالوصول/);

    expect(pageLayoutCount(container)).toBe(1);
    expect(pageHeaderCount(container)).toBe(1);
  });
});

describe('operations hub — no duplicated layout or header', () => {
  it('never renders a second shell after navigating through several tabs', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('maintenance-body');

    for (const tabName of [/المرافق والعدادات/, /الأتمتة والتنبيهات/, /خزينة المستندات/, /الصيانة/]) {
      await user.click(screen.getByRole('tab', { name: tabName }));
      await waitFor(() => {
        expect(pageLayoutCount(container)).toBe(1);
        expect(pageHeaderCount(container)).toBe(1);
      });
    }
  });
});
