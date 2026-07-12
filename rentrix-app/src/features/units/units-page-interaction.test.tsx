// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { UnitsPage } from './units-page';

// Global navigation spy
const mockNavigate = vi.fn();

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

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ action }: any) => <header>{action}</header>,
}));

vi.mock('./use-units', () => ({
  useAllUnits: () => ({
    data: [
      { id: 'unit-1', property_id: 'prop-1', unit_number: '101', status: 'available', rent_amount: 1500, floor: '1' }
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateUnit: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateUnit: () => ({ isPending: false, mutateAsync: vi.fn() }),
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
      root.render(<UnitsPage />);
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

  it('proves clicking a desktop row in UnitsPage navigates to nested unit detail URL', async () => {
    await act(async () => {
      root.render(<UnitsPage />);
    });

    // Locate desktop row in table body
    const row = container?.querySelector('tbody tr') as HTMLElement;
    expect(row).not.toBeNull();

    // Click the row (not on the anchor)
    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Verify row click correctly navigates to nested unit detail
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'prop-1', unitId: 'unit-1' },
    });
  });

  it('proves clicking a mobile card in UnitsPage navigates to nested unit detail URL', async () => {
    await act(async () => {
      root.render(<UnitsPage />);
    });

    // Locate the first mobile entity card
    const cardButton = container?.querySelector('[role="listitem"] [role="button"]') as HTMLElement;
    expect(cardButton).not.toBeNull();

    // Click the mobile card
    await act(async () => {
      cardButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Verify card click correctly navigates to nested unit detail
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'prop-1', unitId: 'unit-1' },
    });
  });

  it('proves that clicking the embedded property link does not bubble and routes only to property detail', async () => {
    await act(async () => {
      root.render(<UnitsPage />);
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
