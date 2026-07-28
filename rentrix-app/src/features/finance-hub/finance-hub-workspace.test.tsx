// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthorizationContext, AuthorizationRole } from '@/features/auth/permissions';

/**
 * Behavioural tests for the shared finance workspace.
 *
 * These render the real FinanceHubWorkspace inside a real router so the
 * URL-synchronisation, permission filtering, and state-preservation guarantees
 * are proven by observable behaviour rather than by reading source strings.
 *
 * The eight section bodies are replaced with lightweight probes: this suite is
 * about the composition layer, and the bodies have their own tests.
 */

let currentRole: AuthorizationRole | null = 'ADMIN';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    authorization: currentRole
      ? ({ userId: `user-${currentRole}`, email: 'user@example.com', role: currentRole } satisfies AuthorizationContext)
      : null,
  }),
}));

/**
 * A stateful probe standing in for a real section body. The counter is local
 * component state, so if the workspace remounts the section on a tab switch
 * the count resets — which is exactly what the state-preservation test asserts.
 */
function makeProbe(name: string) {
  return function Probe() {
    const [count, setCount] = useState(0);
    return (
      <div>
        <span data-testid={`${name}-body`}>{name} body</span>
        <span data-testid={`${name}-count`}>{count}</span>
        <button type="button" data-testid={`${name}-increment`} onClick={() => setCount((value) => value + 1)}>
          increment {name}
        </button>
      </div>
    );
  };
}

vi.mock('@/features/financials/invoices/invoices-page', () => ({ InvoicesWorkspace: makeProbe('invoices') }));
vi.mock('@/features/financials/receipts/receipts-page', () => ({ ReceiptsWorkspace: makeProbe('receipts') }));
vi.mock('@/features/financials/expenses/expenses-page', () => ({ ExpensesWorkspace: makeProbe('expenses') }));
vi.mock('@/features/financials/arrears/arrears-page', () => ({ ArrearsWorkspace: makeProbe('arrears') }));
vi.mock('@/features/financials/deposits/deposits-page', () => ({ DepositsWorkspace: makeProbe('deposits') }));
vi.mock('@/features/owners/owner-settlements-page', () => ({ OwnerSettlementsWorkspace: makeProbe('owner_settlements') }));
vi.mock('@/features/financials/reconciliation/bank-reconciliation-page', () => ({ BankReconciliationWorkspace: makeProbe('bank_reconciliation') }));
vi.mock('@/features/commissions/commissions-page', () => ({ CommissionsWorkspace: makeProbe('commissions') }));

const { FinanceHubWorkspace } = await import('./finance-hub-workspace');
const { CollectionsHubPage } = await import('./collections-hub-page');
const { ExpensesArrearsHubPage } = await import('./expenses-arrears-hub-page');
const { DepositsSettlementsHubPage } = await import('./deposits-settlements-hub-page');
const { BankingCommissionsHubPage } = await import('./banking-commissions-hub-page');

type RenderOptions = Readonly<{
  initialUrl?: string;
  role?: AuthorizationRole | null;
  component?: () => React.ReactNode;
}>;

function renderHub({ initialUrl = '/finance/collections', role = 'ADMIN', component }: RenderOptions = {}) {
  currentRole = role;

  const rootRoute = createRootRoute();
  const hubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/finance/collections',
    component: component ?? (() => <CollectionsHubPage />),
    validateSearch: (search: Record<string, unknown>) => search,
  });
  // Extra entry points so cross-hub deep links resolve like they do in the app.
  const otherRoutes = (['/finance/expenses', '/finance/deposits', '/finance/banking'] as const).map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: component ?? (() => <CollectionsHubPage />),
      validateSearch: (search: Record<string, unknown>) => search,
    }),
  );

  const router = createRouter({
    routeTree: rootRoute.addChildren([hubRoute, ...otherRoutes]),
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

describe('finance hub — standalone rendering', () => {
  it('renders the shared page shell exactly once', async () => {
    const { container } = renderHub();

    await screen.findByTestId('invoices-body');

    expect(pageLayoutCount(container)).toBe(1);
    expect(pageHeaderCount(container)).toBe(1);
  });

  it('shows the entry page default section when the URL requests nothing', async () => {
    renderHub({ initialUrl: '/finance/collections' });

    expect(await screen.findByTestId('invoices-body')).toBeTruthy();
  });

  it('renders the tab bar with one tab per permitted section', async () => {
    renderHub();
    await screen.findByTestId('invoices-body');

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(8);
  });
});

describe('finance hub — every entry page uses the shared workspace', () => {
  const entryPages = [
    ['collections', () => <CollectionsHubPage />, 'invoices'],
    ['expenses/arrears', () => <ExpensesArrearsHubPage />, 'expenses'],
    ['deposits/settlements', () => <DepositsSettlementsHubPage />, 'deposits'],
    ['banking/commissions', () => <BankingCommissionsHubPage />, 'bank_reconciliation'],
  ] as const;

  for (const [name, component, expectedDefault] of entryPages) {
    it(`${name} renders its default section with a single shell`, async () => {
      const { container } = renderHub({ component });

      expect(await screen.findByTestId(`${expectedDefault}-body`)).toBeTruthy();
      expect(pageLayoutCount(container)).toBe(1);
      expect(pageHeaderCount(container)).toBe(1);
    });
  }
});

describe('finance hub — URL synchronisation and deep linking', () => {
  it('opens the section named in the URL instead of the entry default', async () => {
    renderHub({ initialUrl: '/finance/collections?section=receipts' });

    expect(await screen.findByTestId('receipts-body')).toBeTruthy();
  });

  it('honours a deep link to a section owned by a different entry page', async () => {
    renderHub({ initialUrl: '/finance/collections?section=commissions' });

    expect(await screen.findByTestId('commissions-body')).toBeTruthy();
  });

  it('writes the active section into the URL when a tab is clicked', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('invoices-body');

    await user.click(screen.getByRole('tab', { name: /التحصيل والإيصالات/ }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ section: 'receipts' });
    });
    expect(await screen.findByTestId('receipts-body')).toBeTruthy();
  });

  it('replaces history when switching tabs so Back leaves the hub', async () => {
    const user = userEvent.setup();
    const { router } = renderHub();
    await screen.findByTestId('invoices-body');

    const lengthBefore = router.history.length;
    await user.click(screen.getByRole('tab', { name: /التحصيل والإيصالات/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ section: 'receipts' }));

    expect(router.history.length).toBe(lengthBefore);
  });

  it('preserves unrelated query parameters when switching tabs', async () => {
    const user = userEvent.setup();
    const { router } = renderHub({ initialUrl: '/finance/collections?receiptId=abc-123' });
    await screen.findByTestId('invoices-body');

    await user.click(screen.getByRole('tab', { name: /التحصيل والإيصالات/ }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ receiptId: 'abc-123', section: 'receipts' });
    });
  });

  it('falls back to the default section for an unknown section value', async () => {
    renderHub({ initialUrl: '/finance/collections?section=not-a-real-section' });

    expect(await screen.findByTestId('invoices-body')).toBeTruthy();
  });
});

describe('finance hub — state preservation across tab switches', () => {
  it('keeps a visited section mounted so its state survives a round trip', async () => {
    const user = userEvent.setup();
    renderHub();
    await screen.findByTestId('invoices-body');

    // Build up local state in the invoices section.
    await user.click(screen.getByTestId('invoices-increment'));
    await user.click(screen.getByTestId('invoices-increment'));
    expect(screen.getByTestId('invoices-count').textContent).toBe('2');

    // Switch away and back.
    await user.click(screen.getByRole('tab', { name: /التحصيل والإيصالات/ }));
    expect(await screen.findByTestId('receipts-body')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: /الفواتير/ }));
    await screen.findByTestId('invoices-body');

    // State survived: the section was hidden, not remounted.
    expect(screen.getByTestId('invoices-count').textContent).toBe('2');
  });

  it('keeps the previous section in the DOM but hidden after switching', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('invoices-body');

    await user.click(screen.getByRole('tab', { name: /التحصيل والإيصالات/ }));
    await screen.findByTestId('receipts-body');

    const invoicesPanel = container.querySelector('[data-finance-section="invoices"]');
    const receiptsPanel = container.querySelector('[data-finance-section="receipts"]');

    expect(invoicesPanel).not.toBeNull();
    expect(invoicesPanel?.hasAttribute('hidden')).toBe(true);
    expect(receiptsPanel?.hasAttribute('hidden')).toBe(false);
  });

  it('does not mount a section before it is visited (lazy loading)', async () => {
    const { container } = renderHub();
    await screen.findByTestId('invoices-body');

    expect(container.querySelector('[data-finance-section="commissions"]')).toBeNull();
    expect(container.querySelector('[data-finance-section="deposits"]')).toBeNull();
    expect(screen.queryByTestId('commissions-body')).toBeNull();
  });
});

describe('finance hub — permission filtering', () => {
  it('hides tabs a USER may not open', async () => {
    renderHub({ role: 'USER' });
    await screen.findByTestId('invoices-body');

    const tabNames = screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
    expect(tabNames).toHaveLength(2);
    expect(tabNames.join(' ')).toContain('الفواتير');
    expect(tabNames.join(' ')).toContain('التحصيل والإيصالات');
    expect(tabNames.join(' ')).not.toContain('عمولات');
  });

  it('refuses a deep link to a section the user may not see', async () => {
    renderHub({ initialUrl: '/finance/collections?section=commissions', role: 'USER' });

    expect(await screen.findByText(/غير مصرح بالوصول/)).toBeTruthy();
    expect(screen.queryByTestId('commissions-body')).toBeNull();
  });

  it('never renders a forbidden section body even as a hidden panel', async () => {
    const { container } = renderHub({ role: 'USER' });
    await screen.findByTestId('invoices-body');

    for (const forbidden of ['expenses', 'arrears', 'deposits', 'owner_settlements', 'bank_reconciliation', 'commissions']) {
      expect(container.querySelector(`[data-finance-section="${forbidden}"]`)).toBeNull();
    }
  });

  it('degrades to the first permitted section when the entry default is forbidden', async () => {
    // USER opening the expenses entry page cannot see expenses.
    renderHub({ role: 'USER', component: () => <ExpensesArrearsHubPage /> });

    expect(await screen.findByTestId('invoices-body')).toBeTruthy();
    expect(screen.queryByTestId('expenses-body')).toBeNull();
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

describe('finance hub — no duplicated layout or header', () => {
  it('never renders a second shell after navigating through several tabs', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('invoices-body');

    for (const tabName of [/التحصيل والإيصالات/, /المصروفات التشغيلية/, /عمولات المكتب/, /الفواتير/]) {
      await user.click(screen.getByRole('tab', { name: tabName }));
      await waitFor(() => {
        expect(pageLayoutCount(container)).toBe(1);
        expect(pageHeaderCount(container)).toBe(1);
      });
    }
  });

  it('renders each section body without its own layout wrapper', async () => {
    const user = userEvent.setup();
    const { container } = renderHub();
    await screen.findByTestId('invoices-body');
    await user.click(screen.getByRole('tab', { name: /مطابقة كشف البنك/ }));
    await screen.findByTestId('bank_reconciliation-body');

    const panel = container.querySelector('[data-finance-section="bank_reconciliation"]');
    expect(panel?.querySelector('[data-page-layout]')).toBeNull();
    expect(panel?.querySelector('[data-page-header]')).toBeNull();
  });
});

describe('finance hub — accessibility wiring', () => {
  it('links each tab to its panel', async () => {
    renderHub();
    await screen.findByTestId('invoices-body');

    const activeTab = screen.getByRole('tab', { name: /الفواتير/ });
    expect(activeTab.getAttribute('aria-selected')).toBe('true');
    expect(activeTab.getAttribute('aria-controls')).toBe('section-panel-invoices');

    const panel = document.getElementById('section-panel-invoices');
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe('section-tab-invoices');
  });
});

describe('finance hub — direct workspace usage', () => {
  it('accepts any section as the default', async () => {
    renderHub({
      component: () => (
        <FinanceHubWorkspace defaultSection="arrears" title="عنوان تجريبي" description="وصف تجريبي" />
      ),
    });

    expect(await screen.findByTestId('arrears-body')).toBeTruthy();
    expect(screen.getByText('عنوان تجريبي')).toBeTruthy();
  });
});
