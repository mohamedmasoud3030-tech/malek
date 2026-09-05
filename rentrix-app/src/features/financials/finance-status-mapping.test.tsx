// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/status-badge';
import { AmountText } from '@/components/ui/amount';
import {
  getFinanceStatusTone,
  mapInvoiceStatusToFinanceKind,
  buildDrillDownSearch,
} from './finance-status-mapping';

/**
 * Wave 2 finance reporting contract.
 *
 * Finance no longer ships its own visual foundations: statuses resolve through
 * `finance-status-mapping` and render with the canonical `StatusBadge`, and
 * amounts render with the canonical `AmountText` island. These tests pin the
 * mapping and the "never colour-only" rendering rule on the shared primitives.
 */
describe('Wave 2 finance reporting semantics', () => {
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
    expect((result as Record<string, unknown>).extra).toBeUndefined();
  });

  it('renders one canonical status indicator with a visible text label', () => {
    const kind = mapInvoiceStatusToFinanceKind('paid');
    const { container } = render(
      <StatusBadge tone={getFinanceStatusTone(kind)}>مدفوعة</StatusBadge>,
    );
    const badge = container.querySelector('[data-status-badge]');

    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-tone')).toBe('success');
    expect(container.querySelectorAll('[data-status-dot]')).toHaveLength(0);
    expect(container.textContent).toContain('مدفوعة');
  });

  it('can add the status dot without removing the text label', () => {
    const kind = mapInvoiceStatusToFinanceKind('draft');
    const { container } = render(
      <StatusBadge tone={getFinanceStatusTone(kind)} dot>
        مسودة
      </StatusBadge>,
    );
    expect(container.querySelectorAll('[data-status-dot]')).toHaveLength(1);
    expect(container.textContent).toContain('مسودة');
  });

  it('status mapping is not color-only because the label is always present', () => {
    const kind = mapInvoiceStatusToFinanceKind('overdue');
    const { container } = render(
      <StatusBadge tone={getFinanceStatusTone(kind)}>متأخرة</StatusBadge>,
    );
    expect(container.textContent).toContain('متأخرة');
    expect(container.querySelector('[data-status-badge]')?.getAttribute('data-tone')).toBe('danger');
  });

  it('amounts render as an LTR tabular island inside RTL', () => {
    const { container } = render(
      <div dir="rtl">
        <AmountText>1,234.560 OMR</AmountText>
      </div>,
    );
    const amount = container.querySelector('[data-amount-text]');
    expect(amount).not.toBeNull();
    expect(amount?.textContent).toContain('1,234.560');
    expect(amount?.getAttribute('dir')).toBe('ltr');
    expect(amount?.className).toContain('tabular-nums');
  });
});
