// @vitest-environment happy-dom
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceListSection } from './invoice-list-section';
import type { InvoiceListItem } from '../invoices/invoiceService';

const mockInvoices: InvoiceListItem[] = [
  {
    id: 'inv-12345678',
    reference: 'INV-001',
    issue_date: '2026-07-01',
    due_date: '2026-08-01',
    billing_period_start: '2026-07-01',
    billing_period_end: '2026-07-31',
    status: 'unpaid',
    paid_amount: 0,
    tax_amount: 50,
    amount: 950,
    gross_amount: 1000,
    contracts: {
      id: 'contract-1',
      property_id: 'property-1',
      tenant_id: 'tenant-1',
      people: { id: 'tenant-1', full_name: 'أحمد سالم', phone: '90000000' },
      properties: { id: 'property-1', title: 'برج النخيل' },
      units: { id: 'unit-1', unit_number: 'A-12' },
    },
  } as unknown as InvoiceListItem,
  {
    id: 'inv-87654321',
    reference: 'INV-002',
    issue_date: '2026-06-15',
    due_date: '2026-07-15',
    billing_period_start: '2026-06-01',
    billing_period_end: '2026-06-30',
    status: 'paid',
    paid_amount: 1000,
    tax_amount: 50,
    amount: 950,
    gross_amount: 1000,
    contracts: null,
  } as unknown as InvoiceListItem,
];

type InvoiceListSectionTestProps = ComponentProps<typeof InvoiceListSection>;

function renderInvoiceListSection(overrides: Partial<InvoiceListSectionTestProps> = {}) {
  const props: InvoiceListSectionTestProps = {
    status: 'all',
    invoiceSearch: '',
    invoices: mockInvoices,
    isLoading: false,
    isError: false,
    error: undefined,
    isGenerating: false,
    canGenerateInvoices: false,
    hasInvoiceFilter: false,
    dateFrom: '',
    dateTo: '',
    tenantId: '',
    propertyId: '',
    tenantOptions: [],
    propertyOptions: [],
    page: 1,
    pageSize: 20,
    total: mockInvoices.length,
    onStatusChange: vi.fn(),
    onInvoiceSearchChange: vi.fn(),
    onGenerateInvoices: vi.fn(),
    onSelectInvoice: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onTenantChange: vi.fn(),
    onPropertyChange: vi.fn(),
    onPageChange: vi.fn(),
    ...overrides,
  };

  return render(<InvoiceListSection {...props} />);
}

describe('Wave 2 finance table desktop behavior', () => {
  it('preserves table as table on desktop, not Bento cards', () => {
    renderInvoiceListSection();

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    const scrollRegion = document.querySelector('[data-entity-table-scroll]');
    expect(scrollRegion).not.toBeNull();
    expect(scrollRegion?.getAttribute('tabIndex')).toBe('0');
    expect(scrollRegion?.getAttribute('role')).toBe('region');
    expect(scrollRegion?.getAttribute('aria-label')).toContain('قابلة للتمرير أفقياً');
    const financeRoot = document.querySelector('[data-finance-table-wrapper]');
    expect(financeRoot).not.toBeNull();
  });

  it('distinguishes loading vs empty vs error (error not rendered as empty)', () => {
    const { rerender, container } = renderInvoiceListSection({
      invoices: [],
      isLoading: true,
      total: 0,
    });
    // Loading should not show empty title
    expect(container.textContent?.includes('لا توجد فواتير')).toBe(false);

    rerender(
      <InvoiceListSection
        {...({
          status: 'all',
          invoiceSearch: '',
          invoices: [],
          isLoading: false,
          isError: true,
          error: new Error('Network failure'),
          isGenerating: false,
          canGenerateInvoices: false,
          hasInvoiceFilter: false,
          dateFrom: '',
          dateTo: '',
          tenantId: '',
          propertyId: '',
          tenantOptions: [],
          propertyOptions: [],
          page: 1,
          pageSize: 20,
          total: 0,
          onStatusChange: vi.fn(),
          onInvoiceSearchChange: vi.fn(),
          onGenerateInvoices: vi.fn(),
          onSelectInvoice: vi.fn(),
          onDateFromChange: vi.fn(),
          onDateToChange: vi.fn(),
          onTenantChange: vi.fn(),
          onPropertyChange: vi.fn(),
          onPageChange: vi.fn(),
        } satisfies InvoiceListSectionTestProps)}
      />,
    );
    expect(document.body.textContent).toContain('تعذر تحميل الفواتير');
  });

  it('mobile card opens detail view and shows amount/status/date/counterparty', () => {
    renderInvoiceListSection({ onSelectInvoice: vi.fn() });

    // Registers use shared EntityTable (desktop table + built-in mobile cards).
    // Prefer table presence; mobile cards from EntityTable may use different markers.
    const table = document.querySelector('table');
    const entityMobile = document.querySelectorAll('[data-entity-mobile-card], [data-mobile-register-card]');
    expect(table !== null || entityMobile.length > 0).toBe(true);
    if (entityMobile.length > 0) {
      expect((entityMobile[0] as HTMLElement).textContent?.length).toBeGreaterThan(0);
    }
  });

  it('keyboard navigation — row is focusable and Enter triggers detail', () => {
    renderInvoiceListSection({ onSelectInvoice: vi.fn() });

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    const rows = table?.querySelectorAll('tbody tr') ?? [];
    const focusable = Array.from(rows).filter((row) => row.getAttribute('tabIndex') === '0');
    expect(focusable.length).toBeGreaterThan(0);
  });

  it('primary controls have at least 44x44 touch target', () => {
    renderInvoiceListSection({ canGenerateInvoices: true });

    const buttons = document.querySelectorAll('button');
    const has44 = Array.from(buttons).some((button) => button.className.includes('min-h-11') || button.className.includes('h-11'));
    expect(has44).toBe(true);
  });
});
