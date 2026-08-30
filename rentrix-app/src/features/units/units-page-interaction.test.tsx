// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { UnitsPage } from './units-page';

// Global navigation spy
const mockNavigate = vi.fn();
const createUnitMock = vi.fn();
const updateUnitMock = vi.fn();

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: (props: any) => {
    return (
      <a 
        data-testid="mock-link" 
        onClick={(e) => {
          if (props.onClick) props.onClick(e);
          if (!e.defaultPrevented) {
            mockNavigate({ to: props.to, params: props.params });
          }
        }}
        href={props.to}
      >
        {props.children}
      </a>
    );
  },
}));

// Mirror real PageHeader: primaryAction is the current API; `action` is the
// deprecated alias. EmbeddableWorkspace (and the units page) pass primaryAction.
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ action, primaryAction, secondaryActions }: any) => (
    <header data-page-header>
      {secondaryActions}
      {primaryAction ?? action}
    </header>
  ),
}));

vi.mock('./use-units', () => ({
  useAllUnits: () => ({
    data: [
      { id: 'unit-1', property_id: 'prop-1', unit_number: '101', status: 'available', rent_amount: 1500, floor: '1' }
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateUnit: () => ({ isPending: false, mutateAsync: createUnitMock }),
  useUpdateUnit: () => ({ isPending: false, mutateAsync: updateUnitMock }),
  useUnitDetail: () => ({
    data: {
      id: 'unit-1', property_id: 'prop-1', unit_number: '101', status: 'available',
      rent_amount: 1500, daily_reference_rate: null, floor: '1', notes: null, name: null,
      created_at: '', updated_at: '', deleted_at: null, company_id: 'company-1',
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/features/properties/use-properties', () => ({
  useProperties: () => ({
    data: {
      rows: [
        { id: 'prop-1', title: 'برج الخليج', status: 'active' }
      ],
      count: 1,
    },
    isLoading: false,
  }),
}));

describe('Global UnitsPage Real Rendered User-Interaction Tests', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;

  beforeEach(() => {
    vi.clearAllMocks();
    createUnitMock.mockResolvedValue(undefined);
    updateUnitMock.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (container) {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
      container = null;
    }
  });

  it('exposes a mobile-safe create entry point and opens the unit form from the global units route', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsPage />
        </QueryClientProvider>,
      );
    });

    const addButton = Array.from(container?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('إضافة وحدة')) as HTMLButtonElement | undefined;
    expect(addButton).toBeTruthy();

    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('اختيار العقار مطلوب');
    expect(document.body.textContent).toContain('رقم الوحدة');
  });

  it('opens the edit form from the mobile card without requiring property selection again', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsPage />
        </QueryClientProvider>,
      );
    });

    const editButton = Array.from(container?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('تعديل')) as HTMLButtonElement | undefined;
    expect(editButton).toBeTruthy();

    await act(async () => {
      editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('تعديل وحدة');
    expect(document.body.textContent).toContain('رقم الوحدة');
    expect(document.body.textContent).not.toContain('اختيار العقار مطلوب');
  });

  it('proves clicking a desktop row in UnitsPage opens the shared unit preview', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsPage />
        </QueryClientProvider>,
      );
    });

    // Locate desktop row in table body
    const row = container?.querySelector('tbody tr') as HTMLElement;
    expect(row).not.toBeNull();

    // Click the row (not on the anchor)
    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Row clicks give a quick glance; the full dossier stays an explicit action.
    expect(document.body.textContent).toContain('معاينة الوحدة');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('proves the explicit full-detail action routes to the unit dossier', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsPage />
        </QueryClientProvider>,
      );
    });

    const fullDetail = Array.from(container?.querySelectorAll('a') ?? []).find((anchor) => anchor.textContent?.includes('التفاصيل الكاملة'));
    expect(fullDetail).toBeTruthy();

    await act(async () => {
      fullDetail?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'prop-1', unitId: 'unit-1' },
    });
  });

  it('proves that clicking the embedded property link does not bubble and routes only to property detail', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <UnitsPage />
        </QueryClientProvider>,
      );
    });

    // Locate the embedded property link in the desktop table (under td)
    const propertyLink = container?.querySelector('tbody tr td a[href="/properties/$propertyId"]') as HTMLAnchorElement;
    expect(propertyLink).not.toBeNull();

    // Click the property link
    await act(async () => {
      propertyLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 1. Verify it navigates to the property details route with the correct propertyId
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId',
      params: { propertyId: 'prop-1' },
    });

    // 2. Verify it did NOT trigger the parent row's unit detail navigation!
    expect(mockNavigate).not.toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'prop-1', unitId: 'unit-1' },
    });
  });
});
