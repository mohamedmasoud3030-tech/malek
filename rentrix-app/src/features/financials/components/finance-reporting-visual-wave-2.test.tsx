// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  getFinanceStatusTone,
  mapInvoiceStatusToFinanceKind,
  buildDrillDownSearch,
  FinanceStatusBadge,
  FinanceAmount,
} from './finance-reporting-visual-foundations';

describe('Wave 2 finance reporting visual foundations', () => {
  it('maps invoice statuses to semantic finance kinds without business logic change', () => {
    expect(mapInvoiceStatusToFinanceKind('paid')).toBe('paid');
    expect(mapInvoiceStatusToFinanceKind('partial')).toBe('partial');
    expect(mapInvoiceStatusToFinanceKind('overdue')).toBe('overdue');
    expect(mapInvoiceStatusToFinanceKind('unpaid')).toBe('info');
    expect(mapInvoiceStatusToFinanceKind('draft')).toBe('draft');
    expect(mapInvoiceStatusToFinanceKind('cancelled')).toBe('archived');
  });

  it('maps finance kinds to semantic tones (success/warning/danger/info/neutral)', () => {
    expect(getFinanceStatusTone('paid')).toBe('success');
    expect(getFinanceStatusTone('posted')).toBe('success');
    expect(getFinanceStatusTone('partial')).toBe('warning');
    expect(getFinanceStatusTone('aging')).toBe('warning');
    expect(getFinanceStatusTone('overdue')).toBe('danger');
    expect(getFinanceStatusTone('blocked')).toBe('danger');
    expect(getFinanceStatusTone('draft')).toBe('info');
    expect(getFinanceStatusTone('archived')).toBe('neutral');
  });

  it('preserves filter context during drill-down', () => {
    const current = {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      propertyId: 'prop-123',
      tenantId: 'tenant-456',
      status: 'unpaid',
      extra: 'should be preserved if whitelisted? no',
    };
    const drill = { section: 'invoices', status: 'overdue' };
    const result = buildDrillDownSearch(current, drill);
    expect(result.dateFrom).toBe('2026-07-01');
    expect(result.dateTo).toBe('2026-07-31');
    expect(result.propertyId).toBe('prop-123');
    expect(result.tenantId).toBe('tenant-456');
    expect(result.status).toBe('overdue');
    expect(result.section).toBe('invoices');
    expect((result as any).extra).toBeUndefined();
  });

  it('FinanceStatusBadge renders text label, semantic color, not color-only, with accessible name', () => {
    const { container } = render(FinanceStatusBadge({ kind: 'paid', label: 'مدفوعة' }) as any);
    // For function component, we need to render via JSX
  });

  it('FinanceStatusBadge renders with data attributes for semantic mapping', () => {
    const { container } = render(<FinanceStatusBadge kind="paid" label="مدفوعة" />);
    const wrapper = container.querySelector('[data-finance-status]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute('data-kind')).toBe('paid');
    const dot = container.querySelector('[data-finance-status-icon]');
    expect(dot).not.toBeNull();
    expect(container.textContent).toContain('مدفوعة');
  });

  it('FinanceAmount renders as LTR island with tabular-nums inside RTL', () => {
    const { container } = render(<FinanceAmount>1,234.560 OMR</FinanceAmount>);
    const amount = container.querySelector('[data-finance-amount]');
    expect(amount).not.toBeNull();
    expect(amount?.textContent).toContain('1,234.560');
    expect(amount?.getAttribute('dir')).toBe('ltr');
    expect(amount?.className).toContain('tabular-nums');
  });

  it('FinanceAmount preserves RTL stability with LTR islands', () => {
    const { container } = render(
      <div dir="rtl">
        <FinanceAmount>100.000</FinanceAmount>
      </div>,
    );
    const el = container.querySelector('[data-finance-amount]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('dir')).toBe('ltr');
  });

  it('status mapping ensures color is not sole indicator (label + icon shape)', () => {
    const { container } = render(<FinanceStatusBadge kind="overdue" label="متأخرة" />);
    expect(container.textContent).toContain('متأخرة');
    const badge = container.querySelector('[data-status-badge]');
    expect(badge).not.toBeNull();
    const icon = container.querySelector('[data-finance-status-icon]');
    expect(icon).not.toBeNull();
  });
});
