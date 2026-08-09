import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QUICK_PAYMENT_AMOUNT_INPUT_ID, QUICK_PAYMENT_FORM_ID } from '../invoices/quick-collect';
import { QuickPaymentForm } from './quick-payment-form';

const baseProps = {
  amount: '',
  method: 'cash' as const,
  paymentDate: '2026-07-22',
  reference: '',
  amountValidationMessage: '',
  isPending: false,
  isPaymentDisabled: false,
  onAmountChange: vi.fn(),
  onMethodChange: vi.fn(),
  onPaymentDateChange: vi.fn(),
  onReferenceChange: vi.fn(),
  onPostPayment: vi.fn(),
};

describe('QuickPaymentForm', () => {
  it('exposes a real <form> with a submit button so Enter records the payment', () => {
    const html = renderToStaticMarkup(<QuickPaymentForm {...baseProps} />);
    expect(html).toContain(`id="${QUICK_PAYMENT_FORM_ID}"`);
    expect(html).toContain('<form');
    expect(html).toContain('type="submit"');
    expect(html).toContain(`id="${QUICK_PAYMENT_AMOUNT_INPUT_ID}"`);
  });

  it('keeps OMR collection input at three-decimal precision and exposes stable field ids', () => {
    const html = renderToStaticMarkup(<QuickPaymentForm {...baseProps} />);
    expect(html).toContain('min="0.001"');
    expect(html).toContain('step="0.001"');
    expect(html).toContain('id="quick-payment-date"');
    expect(html).toContain('id="quick-payment-reference"');
    expect(html).toContain('for="quick-payment-reference"');
  });

  it('offers the pay-in-full shortcut when a gross remaining amount exists', () => {
    const html = renderToStaticMarkup(<QuickPaymentForm {...baseProps} remainingAmount={115} />);
    expect(html).toContain('كامل المتبقي');
    // Amount rendering is locale-formatted (Arabic digits); assert it rendered at all.
    const shortcut = html.split('كامل المتبقي')[0];
    expect(shortcut).toContain('<button type="button"');
  });

  it('hides the pay-in-full shortcut when nothing is owed', () => {
    const html = renderToStaticMarkup(<QuickPaymentForm {...baseProps} remainingAmount={0} />);
    expect(html).not.toContain('كامل المتبقي');
  });
});
