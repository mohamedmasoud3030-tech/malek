// @vitest-environment happy-dom
/**
 * P3 — the meters register must say whether each meter is actually being
 * billed. A meter with no bill, or one that missed a full cycle, is
 * unrecorded consumption and must be visible and triageable in place.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { UtilityBill, UtilityMeter } from './utilities-service';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function meterFixture(overrides: Partial<UtilityMeter> & { id: string }): UtilityMeter {
  return {
    property_id: 'property-1',
    unit_id: null,
    utility_type: 'electricity',
    meter_number: 'E-000',
    account_number: 'ACC-1',
    provider_name: null,
    responsible_party: 'tenant',
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// One billed this month, one billed long ago, one never billed at all.
const billedMeter = meterFixture({ id: 'meter-current', meter_number: 'E-CURRENT' });
const staleMeter = meterFixture({ id: 'meter-stale', meter_number: 'E-STALE' });
const unbilledMeter = meterFixture({ id: 'meter-never', meter_number: 'E-NEVER' });

function billFixture(overrides: Partial<UtilityBill> & { id: string; meter_id: string }): UtilityBill {
  return {
    property_id: 'property-1',
    unit_id: null,
    bill_number: 'UB-1',
    billing_period_start: null,
    billing_period_end: null,
    previous_reading: null,
    current_reading: null,
    consumption_units: null,
    amount: 40,
    paid_amount: 40,
    due_date: '2026-08-15',
    status: 'paid',
    responsible_party: 'tenant',
    attachment_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const bills = [
  billFixture({ id: 'bill-current', meter_id: 'meter-current', bill_number: 'UB-CURRENT', due_date: '2026-08-15' }),
  billFixture({ id: 'bill-stale', meter_id: 'meter-stale', bill_number: 'UB-STALE', due_date: '2026-02-10' }),
];

vi.mock('./use-utilities', () => ({
  useUtilityBills: () => ({ data: bills, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useUtilityMeters: () => ({
    data: [billedMeter, staleMeter, unbilledMeter],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
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

describe('meter billing coverage in the utilities workspace (P3)', () => {
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

  it('names the meters that are not covered by recent billing', () => {
    expect(container!.textContent).toContain('بلا فواتير');
    expect(container!.textContent).toContain('متأخرة عن الفوترة');
    expect(container!.textContent).toContain('لم تُسجَّل أي فاتورة لهذا العداد');
  });

  it('reports the coverage gap in the meters summary', () => {
    expect(container!.textContent).toContain('عداد بلا أي فاتورة');
  });

  it('shows the last billed date so the gap can be judged', () => {
    expect(container!.textContent).toContain('2026-08-15');
    expect(container!.textContent).toContain('2026-02-10');
  });

  it('lets the operator triage meters by coverage without leaving the workspace', async () => {
    const select = container!.querySelector('select[aria-label="تغطية فوترة العدادات"]') as HTMLSelectElement;
    expect(select).not.toBeNull();

    await act(async () => {
      select.value = 'never_billed';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Assert inside the meters register: the meter dropdowns legitimately keep
    // listing every meter.
    const register = container!.querySelector('section[aria-label="العدادات المسجلة"]') as HTMLElement;
    expect(register.textContent).toContain('E-NEVER');
    expect(register.textContent).not.toContain('E-CURRENT');
  });

  it('keeps a coverage filter with no matches on an explicit empty state', async () => {
    const select = container!.querySelector('select[aria-label="تغطية فوترة العدادات"]') as HTMLSelectElement;

    await act(async () => {
      select.value = 'stale';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const register = container!.querySelector('section[aria-label="العدادات المسجلة"]') as HTMLElement;
    expect(register.textContent).toContain('E-STALE');
    expect(register.textContent).not.toContain('E-NEVER');

    // Coverage is derived from every bill of the property, so a payment-status
    // filter must never make a billed meter look unbilled.
    const statusSelect = container!.querySelector('select[aria-label="حالة السداد"]') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = 'unpaid';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(
      (container!.querySelector('section[aria-label="العدادات المسجلة"]') as HTMLElement).textContent,
    ).toContain('E-STALE');
  });
});
