// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistantPage } from './ai-assistant-page';

/**
 * Contextual copilot page wiring: the canonical assistant (full route and
 * embedded panel render the same component) must
 *   1. surface a contextual quick action when the user is on an entity page;
 *   2. keep the secondary operational actions behind progressive disclosure;
 *   3. send the derived surface context (validated ids only) with the request.
 */

type Row = Record<string, unknown>;

const TABLES: Record<string, Row[]> = {
  invoices: [
    { id: 'inv-1', contract_id: 'con-1', due_date: '2026-07-15', amount: 219.5, paid_amount: 0, status: 'OPEN', deleted_at: null },
  ],
  contracts: [
    { id: 'con-1', property_id: 'prop-1', tenant_id: 't-1', unit_id: 'u-1', start_date: '2025-10-01', end_date: '2026-09-30', rent_amount: 420, status: 'active', deleted_at: null, people: { full_name: 'أحمد المعمري' }, properties: { title: 'برج صحار', name: null } },
  ],
  properties: [
    { id: 'prop-1', title: 'برج صحار', name: null, status: 'active', deleted_at: null },
  ],
  units: [
    { id: 'u-1', property_id: 'prop-1', status: 'occupied', name: 'A1', unit_number: '1', rent_amount: 420, deleted_at: null },
  ],
  payments: [],
  expenses: [],
  maintenance_records: [],
  tenant_deposits: [],
  people: [{ id: 't-1', full_name: 'أحمد المعمري', deleted_at: null }],
};

function fakeTable(rows: Row[]) {
  const filters: Array<(row: Row) => boolean> = [];
  let limitCount: number | null = null;
  const result = () => {
    let out = rows.filter((row) => filters.every((filter) => filter(row)));
    if (limitCount !== null) out = out.slice(0, limitCount);
    return out;
  };
  const chain: Record<string, unknown> = {
    select: () => chain,
    is: (column: string, value: unknown) => { filters.push((row) => (row[column] ?? null) === value); return chain; },
    eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return chain; },
    in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return chain; },
    lte: (column: string, value: unknown) => { filters.push((row) => String(row[column]) <= String(value)); return chain; },
    gte: (column: string, value: unknown) => { filters.push((row) => String(row[column]) >= String(value)); return chain; },
    not: (column: string, _op: string, value: unknown) => {
      const excluded = String(value).replace(/[()]/g, '').split(',');
      filters.push((row) => !excluded.includes(String(row[column])));
      return chain;
    },
    order: () => chain,
    limit: (count: number) => { limitCount = count; return chain; },
    returns: () => chain,
    range: async (from: number, to: number) => ({ data: result().slice(from, to + 1), error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: result(), error: null }),
  };
  return chain;
}

vi.mock('@/lib/env', () => ({
  env: { supabaseUrl: 'https://mock.supabase.test', supabaseAnonKey: 'mock-anon-key', isConfigured: true },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children?: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => fakeTable(TABLES[table] ?? []),
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'mock-token' } }, error: null }),
    },
  },
}));

const requestBodies: Array<Record<string, unknown>> = [];

beforeEach(() => {
  requestBodies.length = 0;
  window.localStorage.clear();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/functions/v1/ai-assistant')) {
      if (init?.body) requestBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({ reply: 'رد تجريبي مبني على السياق.', grounded: true, caveats: ['قراءة فقط'], meta: { source: 'deterministic' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.pushState({}, '', '/');
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiAssistantPage />
    </QueryClientProvider>,
  );
}

describe('AiAssistantPage contextual copilot UI', () => {
  it('keeps the primary quick actions compact and hides the rest behind المزيد', async () => {
    const clicks = userEvent.setup();
    renderPage();

    for (const title of ['مين متأخر؟', 'مستحق النهارده', 'عقود هتخلص', 'الوحدات الفاضية']) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'الصيانة المفتوحة' })).not.toBeInTheDocument();

    await clicks.click(screen.getByRole('button', { name: 'المزيد' }));
    for (const title of ['الصيانة المفتوحة', 'أهم 5 إجراءات', 'ملخص الشهر', 'فلوس واقفة']) {
      expect(screen.getByRole('button', { name: title })).toBeInTheDocument();
    }

    await clicks.click(screen.getByRole('button', { name: 'أقل' }));
    expect(screen.queryByRole('button', { name: 'الصيانة المفتوحة' })).not.toBeInTheDocument();
  });

  it('offers no contextual entity action on the general assistant surface', () => {
    window.history.pushState({}, '', '/ai-assistant');
    renderPage();
    expect(screen.queryByRole('button', { name: 'ملخص العقار ده' })).not.toBeInTheDocument();
  });

  it('surfaces a contextual quick action on a property page and sends the validated surface context', async () => {
    window.history.pushState({}, '', '/properties/prop-1');
    const clicks = userEvent.setup();
    renderPage();

    const contextual = screen.getByRole('button', { name: 'ملخص العقار ده' });
    await clicks.click(contextual);

    await waitFor(() => {
      expect(screen.getByText('رد تجريبي مبني على السياق.')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(requestBodies).toHaveLength(1);
    const body = requestBodies[0];
    expect(body.action).toBe('explain_current_surface');
    const context = body.context as { surface?: Record<string, unknown>; entity?: Record<string, unknown> };
    expect(context.surface).toMatchObject({
      route: '/properties/prop-1',
      entityType: 'property',
      entityId: 'prop-1',
      entityLabel: 'برج صحار',
    });
    // The entity snapshot is loaded from the authoritative row, not the URL.
    expect(context.entity).toMatchObject({ type: 'property', id: 'prop-1', name: 'برج صحار' });
  });

  it('degrades to a null entity when the routed id cannot be verified', async () => {
    window.history.pushState({}, '', '/properties/ghost-id');
    const clicks = userEvent.setup();
    renderPage();

    await clicks.click(screen.getByRole('button', { name: 'مين متأخر؟' }));
    await waitFor(() => {
      expect(screen.getByText('رد تجريبي مبني على السياق.')).toBeInTheDocument();
    }, { timeout: 5000 });

    const context = requestBodies[0].context as { surface?: Record<string, unknown>; entity?: unknown };
    expect(context.surface).toMatchObject({ entityType: null, entityId: null });
    expect(context.entity).toBeUndefined();
  });
});
