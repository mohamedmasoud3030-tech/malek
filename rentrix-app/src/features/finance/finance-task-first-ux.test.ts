import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

const financePage = source('./FinancePage.tsx');
const financeModel = source('./shell/financeShellModel.ts');
const invoiceWorkspace = source('../financials/components/invoice-workspace-section.tsx');
const invoiceList = source('../financials/components/invoice-list-section.tsx');
const invoiceFilters = source('../financials/components/invoice-filters.tsx');
const invoiceService = source('../financials/invoices/invoiceService.ts');

describe('finance task-first UX', () => {
  it('lands routine finance on invoices and keeps one horizontal workspace nav', () => {
    expect(financeModel).toContain("let sId: FinanceSectionId = 'collections'");
    expect(financeModel).toContain("let vId: FinanceViewId = 'invoices'");
    expect(financePage).toContain('data-finance-primary-nav');
    expect(financePage).not.toContain('FinanceOperationsOverview');
    expect(financePage).not.toContain('lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]');
    expect(financePage).not.toContain('مساحات العمل');
  });

  it('keeps arrears as a specialist view instead of duplicating the daily invoice job', () => {
    expect(financeModel).toMatch(/id: 'arrears'[\s\S]*?showInSectionNavigation: false/);
    expect(financePage).toContain('<ArrearsWorkspace embedded />');
  });

  it('makes the invoice register identify the real business context before collection', () => {
    for (const key of ["key: 'tenant'", "key: 'property_unit'", "key: 'billing_period'", "key: 'remaining'", "key: 'status'"]) {
      expect(invoiceList).toContain(key);
    }
    expect(invoiceList).toContain('invoice.contracts?.people?.full_name');
    expect(invoiceList).toContain('invoice.contracts?.properties?.title');
    expect(invoiceList).toContain('invoice.contracts?.units?.unit_number');
    expect(invoiceList).toContain('invoice.billing_period_start');
    expect(invoiceList).toContain('invoice.billing_period_end');
    expect(invoiceList).toContain('تسجيل الدفعة من نفس سجل الفواتير');
  });

  it('uses one human search across invoice and contract context', () => {
    expect(invoiceFilters).toContain('ابحث برقم الفاتورة، المستأجر، الهاتف، العقار أو الوحدة');
    expect(invoiceService).toContain('properties:properties!contracts_property_id_fkey(id,title)');
    expect(invoiceService).toContain('units:units!contracts_unit_id_fkey(id,unit_number)');
    expect(invoiceService).toContain('people:people!contracts_tenant_id_fkey(id,full_name,phone)');
    expect(invoiceService).toContain('contextContractIds');
  });

  it('keeps billing readiness out of the routine list and only inside invoice generation', () => {
    const listIndex = invoiceWorkspace.indexOf('<InvoiceListSection');
    const dialogStart = invoiceWorkspace.indexOf('function GenerateInvoicesDialog');
    const readinessIndex = invoiceWorkspace.indexOf('<BillingReadinessSection />');
    expect(dialogStart).toBeGreaterThan(-1);
    expect(readinessIndex).toBeGreaterThan(dialogStart);
    expect(listIndex).toBeGreaterThan(readinessIndex);
    expect(invoiceWorkspace.slice(listIndex)).not.toContain('<BillingReadinessSection />');
  });

  it('defaults the invoice register to table mode without changing the shared EntityTable contract', () => {
    expect(invoiceList).toContain("malek:invoices:register-view-mode-v1");
    expect(invoiceList).toContain("window.localStorage.setItem(INVOICE_REGISTER_VIEW_MODE_KEY, 'table')");
    expect(invoiceList).toContain('viewModeStorageKey={registerViewModeKey}');
  });
});
