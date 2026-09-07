/**
 * @vitest-environment happy-dom
 *
 * Regression test for the portfolio hub Units section crash (React error
 * #310, live-QA repro: /properties?section=units always rendered the section
 * error screen). Root cause: UnitsWorkspace's `if (ctrl.isLoading) return`
 * early-return sat ABOVE the `columns` useMemo, so the component called more
 * hooks on the post-loading render than on the loading render.
 *
 * The existing unit tests never caught this because they mock the query
 * layer with isLoading:false from the first render. This test reproduces the
 * real lifecycle: loading first, then data arrival.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import type { Unit } from '@/types/domain';

const mockNavigate = vi.fn();

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: any) => (
    <a data-testid="mock-link" onClick={(e: any) => {
      if (props.onClick) props.onClick(e);
      if (!e.defaultPrevented) mockNavigate({ to: props.to, params: props.params });
    }} href={props.to}>{props.children}</a>
  ),
}));

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ primaryAction, secondaryActions }: any) => (
    <header data-page-header>
      {secondaryActions}
      {primaryAction}
    </header>
  ),
}));

const unitsData: Unit[] = [
  { id: 'u1', property_id: 'p1', unit_number: '101', status: 'occupied', rent_amount: 1200, daily_reference_rate: null, floor: '1', notes: null, name: null, created_at: '', updated_at: '', deleted_at: null, company_id: 'company-1' },
];

// Mirrors the real query lifecycle: loading first, data later.
let unitsLoading = true;

vi.mock('./use-units', () => ({
  // Real react-query semantics: `data` is undefined while loading. The
  // controller treats defined data as ready, so [] would skip the gate.
  useAllUnits: () => ({ data: unitsLoading ? undefined : unitsData, isLoading: unitsLoading, isError: false }),
  useUnitDetail: () => ({ data: unitsData[0], isLoading: false, isError: false }),
  useCreateUnit: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useUpdateUnit: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSoftDeleteUnit: () => ({ isPending: false, mutate: vi.fn() }),
}));

vi.mock('@/features/properties/use-properties', () => ({
  // Tracks the same lifecycle flag: the controller's gate is
  // `unitsQuery.isLoading && propertiesQuery.isLoading`, so both must start
  // loading for the early-return path to be exercised (as in production).
  useProperties: () => ({
    data: unitsLoading ? undefined : { rows: [{ id: 'p1', title: 'برج الخليج', status: 'active' }], count: 1 },
    isLoading: unitsLoading,
    isError: false,
  }),
}));

import { UnitsWorkspace } from './units-page';

describe('UnitsWorkspace hook-order regression (React #310)', () => {
  it('survives the loading→data transition without changing hook counts', async () => {
    unitsLoading = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // First render: the loading gate path (hooks 1..N-1 only, pre-fix).
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsWorkspace />
        </QueryClientProvider>,
      );
    });
    // Loading gate is active: the loaded-only register content must be absent.
    expect(document.body.textContent).not.toContain('إضافة وحدة');
    expect(document.querySelector('[role="status"]')).not.toBeNull();

    // Data arrives: the post-loading render must not blow up with
    // "Rendered more hooks than during the previous render" (#310).
    unitsLoading = false;
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsWorkspace />
        </QueryClientProvider>,
      );
    });

    expect(document.body.textContent).not.toContain('Something went wrong');
    expect(document.body.textContent).toContain('101');

    await act(async () => root.unmount());
    container.remove();
  });
});
