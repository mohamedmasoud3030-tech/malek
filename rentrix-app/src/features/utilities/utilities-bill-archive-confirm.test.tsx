// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { UtilityBill, UtilityMeter } from './utilities-service';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const meterFixture: UtilityMeter = {
  id: 'meter-1',
  property_id: 'property-1',
  unit_id: null,
  utility_type: 'electricity',
  meter_number: 'E-123',
  account_number: 'ACC-1',
  provider_name: 'شركة كهرباء مسقط',
  responsible_party: 'tenant',
  is_active: true,
  notes: null,
  created_at: '2026-07-01T00:00:00Z',
};

const billFixture: UtilityBill = {
  id: 'bill-1',
  meter_id: 'meter-1',
  property_id: 'property-1',
  unit_id: null,
  bill_number: 'UB-1001',
  billing_period_start: '2026-07-01',
  billing_period_end: '2026-07-31',
  previous_reading: null,
  current_reading: null,
  consumption_units: null,
  amount: 42.5,
  paid_amount: 0,
  due_date: '2026-07-25',
  status: 'unpaid',
  responsible_party: 'tenant',
  attachment_url: null,
  notes: null,
  created_at: '2026-07-01T00:00:00Z',
};

// Controllable delete-bill mutation shared by the mocked hooks.
const deleteBillMutState = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

vi.mock('./use-utilities', () => ({
  useUtilityBills: () => ({ data: [billFixture], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useUtilityMeters: () => ({ data: [meterFixture], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateUtilityMeter: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useCreateUtilityBill: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useDeleteUtilityMeter: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteUtilityBill: () => deleteBillMutState,
}));

vi.mock('@/features/properties/use-properties', () => ({
  useProperties: () => ({ data: { rows: [{ id: 'property-1', title: 'عقار النور' }] }, isLoading: false }),
}));

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => ({
    isReady: true,
    isLoading: false,
    companySettings: { companyName: 'شركة الأفق العقارية', currency: 'OMR', currencySymbol: 'ر.ع', documentPrefixes: {} },
  }),
}));

// Capture the ConfirmDialog contract (title, info rows, confirm/cancel wiring,
// loading state) without depending on Radix portal/focus internals in DOM
// tests — same pattern as units-list-interaction.test.tsx.
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: (props: {
    open: boolean;
    title: string;
    description?: string;
    isLoading?: boolean;
    confirmDisabled?: boolean;
    children?: React.ReactNode;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) => {
    if (!props.open) return null;
    return (
      <div data-testid="bill-confirm-dialog">
        <p data-testid="dialog-title">{props.title}</p>
        <p data-testid="dialog-description">{props.description}</p>
        <div data-testid="dialog-body">{props.children}</div>
        <button
          data-testid="confirm-archive-btn"
          onClick={props.onConfirm}
          disabled={Boolean(props.isLoading) || Boolean(props.confirmDisabled)}
        >
          تأكيد
        </button>
        <button data-testid="cancel-btn" onClick={() => props.onOpenChange(false)}>
          إلغاء
        </button>
      </div>
    );
  },
}));

const toastSpy = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastSpy }));

import { UtilitiesWorkspace } from './components/utilities-workspace';

function click(element: HTMLElement) {
  return act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('utility bill removal requires explicit confirmation (P0)', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    deleteBillMutState.isPending = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => root!.unmount());
      document.body.removeChild(container);
    }
    root = null;
    container = null;
  });

  async function renderWorkspace() {
    await act(async () => {
      root!.render(<UtilitiesWorkspace mode="embedded" />);
    });
  }

  function billTrashButton(): HTMLButtonElement {
    const button = container!.querySelector('button[aria-label^="أرشفة فاتورة المرافق"]') as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    return button!;
  }

  it('opening the dialog does not run the mutation — first click only stages the bill', async () => {
    await renderWorkspace();

    await click(billTrashButton());

    expect(deleteBillMutState.mutate).not.toHaveBeenCalled();
    const dialog = container!.querySelector('[data-testid="bill-confirm-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('أرشفة فاتورة المرافق؟');
  });

  it('shows the bill identity inside the dialog (number, utility, property, amount, period)', async () => {
    await renderWorkspace();

    await click(billTrashButton());

    const body = container!.querySelector('[data-testid="dialog-body"]')!;
    expect(body.textContent).toContain('UB-1001');
    expect(body.textContent).toContain('كهرباء');
    expect(body.textContent).toContain('عقار النور');
    expect(body.textContent).toContain('2026-07-01 → 2026-07-31');
    // Amount row is present (value is locale-formatted money, so assert the label).
    expect(body.textContent).toContain('المبلغ');
    // The description must not claim a permanent/irreversible delete because
    // the backend performs a logical (deleted_at) removal.
    expect(container!.querySelector('[data-testid="dialog-description"]')!.textContent)
      .not.toContain('لا يمكن التراجع');
  });

  it('cancelling the dialog never runs the mutation', async () => {
    await renderWorkspace();

    await click(billTrashButton());
    await click(container!.querySelector('[data-testid="cancel-btn"]') as HTMLButtonElement);

    expect(deleteBillMutState.mutate).not.toHaveBeenCalled();
    expect(container!.querySelector('[data-testid="bill-confirm-dialog"]')).toBeNull();
  });

  it('confirming runs the mutation exactly once and closes the dialog on success', async () => {
    await renderWorkspace();

    await click(billTrashButton());
    await click(container!.querySelector('[data-testid="confirm-archive-btn"]') as HTMLButtonElement);

    expect(deleteBillMutState.mutate).toHaveBeenCalledTimes(1);
    const [billId, options] = deleteBillMutState.mutate.mock.calls[0] as unknown as [
      string,
      { onSuccess: () => void },
    ];
    expect(billId).toBe('bill-1');

    await act(async () => {
      options.onSuccess();
    });
    expect(toastSpy.success).toHaveBeenCalled();
    expect(container!.querySelector('[data-testid="bill-confirm-dialog"]')).toBeNull();
  });

  it('double-confirming while the request is in flight does not submit twice', async () => {
    await renderWorkspace();

    await click(billTrashButton());

    // The request becomes in-flight; force a re-render (status filter change)
    // so the dialog observes the pending mutation.
    deleteBillMutState.isPending = true;
    const statusSelect = container!.querySelector('select[aria-label="حالة السداد"]') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = 'paid';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const confirmButton = container!.querySelector('[data-testid="confirm-archive-btn"]') as HTMLButtonElement;
    // The confirm control is disabled for the whole in-flight window.
    expect(confirmButton.disabled).toBe(true);

    await click(confirmButton);
    // The handler guard holds even if the click somehow gets through.
    expect(deleteBillMutState.mutate).not.toHaveBeenCalled();
  });

  it('keeps the dialog actionable on failure with a readable Arabic error toast', async () => {
    await renderWorkspace();

    await click(billTrashButton());
    await click(container!.querySelector('[data-testid="confirm-archive-btn"]') as HTMLButtonElement);

    const [, options] = deleteBillMutState.mutate.mock.calls[0] as unknown as [
      string,
      { onError: (error: unknown) => void },
    ];
    await act(async () => {
      options.onError(new Error('تعذر أرشفة الفاتورة'));
    });

    expect(toastSpy.error).toHaveBeenCalledWith('تعذر أرشفة الفاتورة');
    // The dialog stays open so the user can retry or cancel.
    expect(container!.querySelector('[data-testid="bill-confirm-dialog"]')).not.toBeNull();
  });
});
