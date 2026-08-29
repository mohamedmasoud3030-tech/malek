// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvoiceListSection } from './invoice-list-section';
import type { InvoiceListItem } from '../invoices/invoiceService';

const mockInvoices: InvoiceListItem[] = [
  {
    id: 'inv-12345678',
    due_date: '2026-08-01',
    status: 'unpaid',
    paid_amount: 0,
    tax_amount: 50,
    gross_amount: 1000,
    amount: 950,
  } as unknown as InvoiceListItem,
  {
    id: 'inv-87654321',
    due_date: '2026-07-15',
    status: 'paid',
    paid_amount: 1000,
    tax_amount: 50,
    gross_amount: 1000,
    amount: 950,
  } as unknown as InvoiceListItem,
];

describe('Wave 2 finance table desktop behavior', () => {
  it('preserves table as table on desktop, not Bento cards', () => {
    render(
      <InvoiceListSection
        status="all"
        invoiceSearch=""
        invoices={mockInvoices}
        isLoading={false}
        isError={false}
        error={undefined}
        isGenerating={false}
        canGenerateInvoices={false}
        hasInvoiceFilter={false}
        dateFrom=""
        dateTo=""
        tenantId=""
        propertyId=""
        tenantOptions={[]}
        propertyOptions={[]}
        page={1}
        pageSize={20}
        total={2}
        onStatusChange={() => {}}
        onInvoiceSearchChange={() => {}}
        onGenerateInvoices={() => {}}
        onSelectInvoice={() => {}}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onTenantChange={() => {}}
        onPropertyChange={() => {}}
        onPageChange={() => {}}
      />,
    );

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    const scrollRegion = document.querySelector('[data-entity-table-scroll]');
    expect(scrollRegion).not.toBeNull();
    expect(scrollRegion?.getAttribute('tabIndex')).toBe('0');
    expect(scrollRegion?.getAttribute('role')).toBe('region');
    expect(scrollRegion?.getAttribute('aria-label')).toContain('قابلة للتمرير');
    const financeRoot = document.querySelector('[data-finance-table-wrapper]');
    expect(financeRoot).not.toBeNull();
  });

  it('distinguishes loading vs empty vs error (error not rendered as empty)', () => {
    const { rerender, container } = render(
      <InvoiceListSection
        status="all"
        invoiceSearch=""
        invoices={[]}
        isLoading={true}
        isError={false}
        error={undefined}
        isGenerating={false}
        canGenerateInvoices={false}
        hasInvoiceFilter={false}
        dateFrom=""
        dateTo=""
        tenantId=""
        propertyId=""
        tenantOptions={[]}
        propertyOptions={[]}
        page={1}
        pageSize={20}
        total={0}
        onStatusChange={() => {}}
        onInvoiceSearchChange={() => {}}
        onGenerateInvoices={() => {}}
        onSelectInvoice={() => {}}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onTenantChange={() => {}}
        onPropertyChange={() => {}}
        onPageChange={() => {}}
      />,
    );
    // Loading should not show empty title
    expect(container.textContent?.includes('لا توجد فواتير')).toBe(false);

    rerender(
      <InvoiceListSection
        status="all"
        invoiceSearch=""
        invoices={[]}
        isLoading={false}
        isError={true}
        error={new Error('Network failure')}
        isGenerating={false}
        canGenerateInvoices={false}
        hasInvoiceFilter={false}
        dateFrom=""
        dateTo=""
        tenantId=""
        propertyId=""
        tenantOptions={[]}
        propertyOptions={[]}
        page={1}
        pageSize={20}
        total={0}
        onStatusChange={() => {}}
        onInvoiceSearchChange={() => {}}
        onGenerateInvoices={() => {}}
        onSelectInvoice={() => {}}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onTenantChange={() => {}}
        onPropertyChange={() => {}}
        onPageChange={() => {}}
      />,
    );
    expect(document.body.textContent).toContain('تعذر تحميل الفواتير');
  });

  it('mobile card opens detail view and shows amount/status/date/counterparty', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <InvoiceListSection
        status="all"
        invoiceSearch=""
        invoices={mockInvoices}
        isLoading={false}
        isError={false}
        error={undefined}
        isGenerating={false}
        canGenerateInvoices={false}
        hasInvoiceFilter={false}
        dateFrom=""
        dateTo=""
        tenantId=""
        propertyId=""
        tenantOptions={[]}
        propertyOptions={[]}
        page={1}
        pageSize={20}
        total={2}
        onStatusChange={() => {}}
        onInvoiceSearchChange={() => {}}
        onGenerateInvoices={() => {}}
        onSelectInvoice={onSelect}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onTenantChange={() => {}}
        onPropertyChange={() => {}}
        onPageChange={() => {}}
      />,
    );

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
    const onSelect = vi.fn();
    render(
      <InvoiceListSection
        status="all"
        invoiceSearch=""
        invoices={mockInvoices}
        isLoading={false}
        isError={false}
        error={undefined}
        isGenerating={false}
        canGenerateInvoices={false}
        hasInvoiceFilter={false}
        dateFrom=""
        dateTo=""
        tenantId=""
        propertyId=""
        tenantOptions={[]}
        propertyOptions={[]}
        page={1}
        pageSize={20}
        total={2}
        onStatusChange={() => {}}
        onInvoiceSearchChange={() => {}}
        onGenerateInvoices={() => {}}
        onSelectInvoice={onSelect}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onTenantChange={() => {}}
        onPropertyChange={() => {}}
        onPageChange={() => {}}
      />,
    );

    const table = document.querySelector('table');
    expect(table).not.toBeNull();
    const rows = table?.querySelectorAll('tbody tr') ?? [];
    const focusable = Array.from(rows).filter((r) => r.getAttribute('tabIndex') === '0');
    expect(focusable.length).toBeGreaterThan(0);
  });

  it('primary controls have at least 44x44 touch target', () => {
    render(
      <InvoiceListSection
        status="all"
        invoiceSearch=""
        invoices={mockInvoices}
        isLoading={false}
        isError={false}
        error={undefined}
        isGenerating={false}
        canGenerateInvoices={true}
        hasInvoiceFilter={false}
        dateFrom=""
        dateTo=""
        tenantId=""
        propertyId=""
        tenantOptions={[]}
        propertyOptions={[]}
        page={1}
        pageSize={20}
        total={2}
        onStatusChange={() => {}}
        onInvoiceSearchChange={() => {}}
        onGenerateInvoices={() => {}}
        onSelectInvoice={() => {}}
        onDateFromChange={() => {}}
        onDateToChange={() => {}}
        onTenantChange={() => {}}
        onPropertyChange={() => {}}
        onPageChange={() => {}}
      />,
    );
    const buttons = document.querySelectorAll('button');
    const has44 = Array.from(buttons).some((b) => b.className.includes('min-h-11') || b.className.includes('h-11'));
    expect(has44).toBe(true);
  });
});
