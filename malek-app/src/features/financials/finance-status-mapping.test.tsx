// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/status-badge';
import { AmountText } from '@/components/ui/amount';
import { getInvoiceStatusTone } from './finance-status-mapping';

/**
 * Finance reporting contract.
 *
 * Finance ships no visual foundations of its own: statuses resolve through
 * `finance-status-mapping` and render with the canonical `StatusBadge`, and
 * amounts render with the canonical `AmountText` island. These tests pin the
 * mapping and the "never colour-only" rendering rule on the shared primitives.
 */
describe('finance status semantics', () => {
  it('maps canonical invoice statuses to semantic tones', () => {
    expect(getInvoiceStatusTone('paid')).toBe('success');
    expect(getInvoiceStatusTone('partial')).toBe('warning');
    expect(getInvoiceStatusTone('overdue')).toBe('danger');
    expect(getInvoiceStatusTone('unpaid')).toBe('info');
    expect(getInvoiceStatusTone('draft')).toBe('info');
    expect(getInvoiceStatusTone('cancelled')).toBe('neutral');
    expect(getInvoiceStatusTone('void')).toBe('neutral');
  });

  it('normalizes every live casing so one status can never render two colours', () => {
    expect(getInvoiceStatusTone('PAID')).toBe('success');
    expect(getInvoiceStatusTone('PARTIALLY_PAID')).toBe('warning');
    expect(getInvoiceStatusTone('OVERDUE')).toBe('danger');
    expect(getInvoiceStatusTone('UNPAID')).toBe('info');
    expect(getInvoiceStatusTone('issued')).toBe('info');
    expect(getInvoiceStatusTone('VOID')).toBe('neutral');
    expect(getInvoiceStatusTone(null)).toBe('neutral');
    expect(getInvoiceStatusTone('something-unknown')).toBe('neutral');
  });

  it('renders one canonical status indicator with a visible text label', () => {
    const { container } = render(
      <StatusBadge tone={getInvoiceStatusTone('paid')}>مدفوعة</StatusBadge>,
    );
    const badge = container.querySelector('[data-status-badge]');

    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-tone')).toBe('success');
    expect(container.querySelectorAll('[data-status-dot]')).toHaveLength(0);
    expect(container.textContent).toContain('مدفوعة');
  });

  it('can add the status dot without removing the text label', () => {
    const { container } = render(
      <StatusBadge tone={getInvoiceStatusTone('draft')} dot>
        مسودة
      </StatusBadge>,
    );
    expect(container.querySelectorAll('[data-status-dot]')).toHaveLength(1);
    expect(container.textContent).toContain('مسودة');
  });

  it('status mapping is not color-only because the label is always present', () => {
    const { container } = render(
      <StatusBadge tone={getInvoiceStatusTone('overdue')}>متأخرة</StatusBadge>,
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
