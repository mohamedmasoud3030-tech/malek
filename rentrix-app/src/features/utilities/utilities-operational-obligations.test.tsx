// @vitest-environment happy-dom
/**
 * P3 — the Utilities workspace must show the operational obligation, not only
 * a billing archive: what is still owed, what is already late, and a way to
 * triage by that urgency.
 */
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

function billFixture(overrides: Partial<UtilityBill>): UtilityBill {
  return {
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
    amount: 100,
    paid_amount: 0,
    due_date: '2026-07-25',
    status: 'unpaid',
    responsible_party: 'tenant',
    attachment_url: null,
    notes: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

// One clearly late claim, one settled claim: the workspace must separate them.
const overdueBill = billFixture({ id: 'bill-late', bill_number: 'UB-LATE', due_date: '2026-07-25', amount: 100, paid_amount: 40 });
const settledBill = billFixture({ id: 'bill-paid', bill_number: 'UB-PAID', due_date: '2026-07-01', amount: 60, paid_amount: 60, status: 'paid' });

vi.mock('./use-utilities', () => ({
  useUtilityBills: () => ({ data: [overdueBill, settledBill], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useUtilityMeters: () => ({ data: [meterFixture], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateUtilityMeter: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useCreateUtilityBill: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useDeleteUtilityMeter: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteUtilityBill: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/features/properties/use-properties', () => ({
  useProperties: () => ({ data: { rows: [{ id: 'property-1', title: 'عقار النور' }] }, isLoading: false }),
}));

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettingsContract: () => ({ defaultCurrency: 'OMR', locale: 'ar-OM', defaultLanguage: 'ar' }),
}));

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => ({
    isReady: true,
    isLoading: false,
    companySettings: { companyName: 'شركة الأفق العقارية', currency: 'OMR', currencySymbol: 'ر.ع', documentPrefixes: {} },
  }),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UtilitiesWorkspace } from './components/utilities-workspace';

describe('utilities operational obligations (P3)', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T09:00:00Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<UtilitiesWorkspace mode="embedded" />);
    });
  });

  afterEach(() => {
    if (root && container) {
      act(() => root!.unmount());
      document.body.removeChild(container);
    }
    root = null;
    container = null;
    vi.useRealTimers();
  });

  it('summarizes overdue utility claims as their own operational KPI', () => {
    expect(container!.textContent).toContain('مطالبات متأخرة');
    expect(container!.textContent).toContain('فاتورة تجاوزت الاستحقاق');
  });

  it('shows the remaining obligation per claim on every viewport, not only amount and paid', () => {
    // The register renders Cards on the mobile default here; the remaining
    // obligation must survive that presentation instead of being a
    // desktop-only column.
    expect(container!.textContent).toContain('المتبقي');
  });

  it('flags how late an unpaid claim is', () => {
    expect(container!.textContent).toContain('متأخرة');
    expect(container!.textContent).toContain('يوم');
  });

  it('lets the operator triage by operational urgency without leaving the workspace', async () => {
    const select = container!.querySelector('select[aria-label="الاستحقاق التشغيلي"]') as HTMLSelectElement;
    expect(select).not.toBeNull();

    await act(async () => {
      select.value = 'overdue';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container!.textContent).toContain('UB-LATE');
    expect(container!.textContent).not.toContain('UB-PAID');
  });

  it('keeps an urgency filter with no matches on an explicit empty state', async () => {
    const select = container!.querySelector('select[aria-label="الاستحقاق التشغيلي"]') as HTMLSelectElement;
    await act(async () => {
      select.value = 'scheduled';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container!.textContent).toContain('لا توجد فواتير ضمن الجدول');
  });
});
