// @vitest-environment happy-dom
import type { UseQueryResult } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { Unit } from '@/types/domain';
import { UnitsList } from './units-list';

// Global navigation & mutation spies
const mockNavigate = vi.fn();
const mockSoftDeleteMutate = vi.fn();

// The page registers permission-gated actions through the shared auth seam.
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ authorization: { role: 'MANAGER' }, canAccess: () => true }),
  useOptionalAuth: () => ({ canAccess: () => true }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children }: any) => children,
}));

// Mock UnitFormModal to capture edit open state and values in rendered DOM
vi.mock('./unit-form-modal', () => ({
  UnitFormModal: (props: any) => {
    if (props.open) {
      return (
        <div data-testid="edit-modal-open">
          فتح معالج التعديل للوحدة: {props.unit?.unit_number}
        </div>
      );
    }
    return null;
  },
}));

// Mock useSoftDeleteUnit query hook - supports both mutate and mutateAsync for compatibility
vi.mock('./use-units', () => ({
  useSoftDeleteUnit: () => ({
    isPending: false,
    mutate: mockSoftDeleteMutate,
    mutateAsync: async (id: string) => {
      mockSoftDeleteMutate(id, {});
      return Promise.resolve();
    },
  }),
}));

// The duplicate-draft guard hook (added 2026-08-21) queries drafts via React
// Query. Pin it to an empty result so the interaction tests stay hermetic.
vi.mock('@/features/contracts/queries/useUnitContractDrafts', () => ({
  useUnitContractDrafts: () => ({ data: [], isLoading: false, isError: false }),
}));

// Mock ConfirmDialog to capture confirmation flow and allow real rendered click
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: (props: any) => {
    if (props.open) {
      return (
        <div data-testid="archive-confirm-dialog">
          <p>{props.title}</p>
          <button data-testid="confirm-archive-btn" onClick={props.onConfirm}>
            تأكيد الأرشفة
          </button>
        </div>
      );
    }
    return null;
  },
}));

function makeUnitsQuery(overrides: Partial<UseQueryResult<Unit[]>>): UseQueryResult<Unit[]> {
  return {
    data: [],
    error: null,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<Unit[]>;
}


function renderUnitsList(unitsQuery: UseQueryResult<Unit[]>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <UnitsList propertyId="property-123" unitsQuery={unitsQuery} />
    </QueryClientProvider>
  );
}

describe('UnitsList Real Rendered User-Interaction Tests', () => {
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

  it('proves clicking a desktop unit row triggers correct unit detail navigation', async () => {
    const unitsQuery = makeUnitsQuery({
      data: [{ id: 'unit-101', unit_number: '101', status: 'available', rent_amount: 1500, floor: '1' } as Unit],
    });

    await act(async () => {
      root.render(renderUnitsList(unitsQuery));
    });

    // Locate the rendered desktop row in the DOM (under tbody)
    const row = container?.querySelector('tbody tr') as HTMLElement;
    expect(row).not.toBeNull();

    // Trigger a real user click on the table row
    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Expect navigation to the nested unit detail URL
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'property-123', unitId: 'unit-101' },
    });
  });

  it('proves clicking a compact responsive table row triggers correct unit detail navigation', async () => {
    const unitsQuery = makeUnitsQuery({
      data: [{ id: 'unit-101', unit_number: '101', status: 'available', rent_amount: 1500, floor: '1' } as Unit],
    });

    await act(async () => {
      root.render(renderUnitsList(unitsQuery));
    });

    const row = container?.querySelector('tbody tr') as HTMLElement;
    expect(row).not.toBeNull();

    await act(async () => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Expect navigation to the nested unit detail URL
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: 'property-123', unitId: 'unit-101' },
    });
  });

  it('proves clicking Edit secondary action does not trigger row click navigation but preserves behavior', async () => {
    const unitsQuery = makeUnitsQuery({
      data: [{ id: 'unit-101', unit_number: '101', status: 'available', rent_amount: 1500, floor: '1' } as Unit],
    });

    await act(async () => {
      root.render(renderUnitsList(unitsQuery));
    });

    const editButton = container?.querySelector<HTMLButtonElement>('button[aria-label="تعديل وحدة 101"]');
    expect(editButton).not.toBeNull();

    // Trigger a click on the secondary Edit button
    await act(async () => {
      editButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 1. Verify row navigation was NOT triggered due to stopPropagation!
    expect(mockNavigate).not.toHaveBeenCalled();

    // 2. Verify that the edit behavior occurred and modal is rendered as open with selected unit!
    const modalMarker = container?.querySelector('[data-testid="edit-modal-open"]');
    expect(modalMarker).not.toBeNull();
    expect(modalMarker?.textContent).toContain('وحدة: 101');
  });

  it('proves clicking Archive secondary action does not trigger row click navigation but triggers confirmation flow', async () => {
    const unitsQuery = makeUnitsQuery({
      data: [{ id: 'unit-101', unit_number: '101', status: 'available', rent_amount: 1500, floor: '1' } as Unit],
    });

    await act(async () => {
      root.render(renderUnitsList(unitsQuery));
    });

    const archiveButton = container?.querySelector<HTMLButtonElement>('button[aria-label="أرشفة وحدة 101"]');
    expect(archiveButton).not.toBeNull();

    // Trigger a click on the secondary Archive button
    await act(async () => {
      archiveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 1. Verify row navigation was NOT triggered due to stopPropagation!
    expect(mockNavigate).not.toHaveBeenCalled();

    // 2. Verify that the confirmation flow opens (dialog renders)
    const dialog = container?.querySelector('[data-testid="archive-confirm-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('أرشفة الوحدة 101؟');

    // 3. Click the confirm button in the rendered dialog
    const confirmBtn = container?.querySelector('[data-testid="confirm-archive-btn"]') as HTMLButtonElement;
    expect(confirmBtn).not.toBeNull();
    await act(async () => {
      confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // 4. Verify that soft delete mutation was successfully invoked with the correct unit id!
    expect(mockSoftDeleteMutate).toHaveBeenCalledWith('unit-101', expect.any(Object));
  });
});
