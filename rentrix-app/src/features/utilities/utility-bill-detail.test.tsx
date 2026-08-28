// @vitest-environment happy-dom
/**
 * P3 — a utility claim must be openable in place: the readings the office
 * captured when recording it, and the provider's own document, belong with the
 * claim (UX-006 contextual-first documents) rather than in a general vault.
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

const billWithReadings: UtilityBill = {
  id: 'bill-1',
  meter_id: 'meter-1',
  property_id: 'property-1',
  unit_id: null,
  bill_number: 'UB-1001',
  billing_period_start: '2026-07-01',
  billing_period_end: '2026-07-31',
  previous_reading: 1200,
  current_reading: 1460,
  consumption_units: 260,
  amount: 100,
  paid_amount: 40,
  due_date: '2026-08-10',
  status: 'partially_paid',
  responsible_party: 'tenant',
  attachment_url: null,
  notes: 'قراءة مؤكدة من المزود',
  created_at: '2026-07-01T00:00:00Z',
};

vi.mock('./use-utilities', () => ({
  useUtilityBills: () => ({ data: [billWithReadings], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
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

// The documents seam is proved elsewhere; here we only prove the utility claim
// gives it a contextual home with the right entity binding.
const contextualDocumentsProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/components/documents/contextual-documents-section', () => ({
  ContextualDocumentsSection: (props: Record<string, unknown>) => {
    contextualDocumentsProps.current = props;
    return <div data-testid="contextual-documents">مستندات مرتبطة</div>;
  },
}));

vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UtilitiesWorkspace } from './components/utilities-workspace';

describe('utility bill detail overlay (P3)', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  async function openDetail() {
    const trigger = document.querySelector(
      'button[aria-label="تفاصيل فاتورة المرافق UB-1001"]',
    ) as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger.click();
    });
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T09:00:00Z'));
    contextualDocumentsProps.current = null;
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

  it('opens the claim from the register', async () => {
    await openDetail();
    expect(document.body.textContent).toContain('UB-1001');
    expect(document.body.textContent).toContain('عقار النور');
  });

  it('shows the readings the office captured, which were previously write-only', async () => {
    await openDetail();
    const detail = document.querySelector('[data-utility-bill-detail]') as HTMLElement;

    expect(detail.textContent).toContain('القراءة السابقة');
    expect(detail.textContent).toContain('1,200');
    expect(detail.textContent).toContain('1,460');
    expect(detail.textContent).toContain('الاستهلاك');
    expect(detail.textContent).toContain('260');
  });

  it('repeats the obligation reading rather than recomputing it', async () => {
    await openDetail();
    const detail = document.querySelector('[data-utility-bill-detail]') as HTMLElement;

    expect(detail.textContent).toContain('المتبقي');
    expect(detail.textContent).toContain('متأخرة');
    expect(detail.textContent).toContain('مدفوعة جزئياً');
  });

  it('gives the provider document a contextual home bound to this claim', async () => {
    await openDetail();

    expect(document.querySelector('[data-testid="contextual-documents"]')).not.toBeNull();
    expect(contextualDocumentsProps.current).toMatchObject({
      entityType: 'utility_bill',
      entityId: 'bill-1',
    });
  });
});
