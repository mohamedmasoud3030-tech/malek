import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectionCard } from '@/components/ui/selection-card';
import type { Payment } from '@/types/domain';
import { QUICK_PAYMENT_AMOUNT_INPUT_ID, QUICK_PAYMENT_FORM_ID } from '../invoices/quick-collect';
import { formatMoney } from './financials-formatters';

const methods: Payment['payment_method'][] = ['cash', 'bank_transfer', 'card', 'check', 'other'];

const methodDetails: Record<Payment['payment_method'], { label: string; desc: string }> = {
  cash: { label: 'نقدي', desc: 'دفع مباشر نقداً' },
  bank_transfer: { label: 'تحويل بنكي', desc: 'إيداع أو تحويل حساب' },
  card: { label: 'بطاقة', desc: 'دفع إلكتروني شبكة' },
  check: { label: 'شيك', desc: 'شيك بنكي مصدق' },
  other: { label: 'أخرى', desc: 'سداد بطريقة إضافية' },
};

type QuickPaymentFormProps = {
  /** Remaining collectible amount (gross). Enables the pay-in-full shortcut. */
  remainingAmount?: number;
  amount: string;
  method: Payment['payment_method'];
  paymentDate: string;
  reference: string;
  amountValidationMessage: string;
  isPending: boolean;
  isPaymentDisabled: boolean;
  /**
   * Monotonic nonce from the «تحصيل» row action. Every increment scrolls the
   * form into view and focuses the amount input so the collector can type
   * (or confirm the prefilled full balance) immediately — even on mobile,
   * where the form sits below the fold.
   */
  focusKey?: number;
  onAmountChange: (amount: string) => void;
  onMethodChange: (method: Payment['payment_method']) => void;
  onPaymentDateChange: (paymentDate: string) => void;
  onReferenceChange: (reference: string) => void;
  onPostPayment: () => void;
};

export function QuickPaymentForm({ remainingAmount, amount, method, paymentDate, reference, amountValidationMessage, isPending, isPaymentDisabled, focusKey = 0, onAmountChange, onMethodChange, onPaymentDateChange, onReferenceChange, onPostPayment }: QuickPaymentFormProps) {
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusKey <= 0) return;
    document.getElementById(QUICK_PAYMENT_FORM_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    amountInputRef.current?.focus({ preventScroll: true });
  }, [focusKey]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPaymentDisabled) onPostPayment();
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-black text-foreground">تسجيل دفعة سريعة</h4>
        {typeof remainingAmount === 'number' && remainingAmount > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-bold text-foreground">
            <span>المبلغ المتبقي للتحصيل:</span>
            <span className="text-primary tabular-nums font-extrabold">{formatMoney(remainingAmount)}</span>
            <button
              type="button"
              className="ms-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-extrabold text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={() => onAmountChange(String(Math.round(remainingAmount * 1000) / 1000))}
            >
              كامل المتبقي
            </button>
          </div>
        ) : null}
      </div>

      <form id={QUICK_PAYMENT_FORM_ID} className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-muted-foreground">اختر طريقة الدفع</label>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {methods.map((item) => (
              <SelectionCard
                key={item}
                selected={method === item}
                title={methodDetails[item].label}
                description={methodDetails[item].desc}
                onClick={() => onMethodChange(item)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 items-start">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground" htmlFor={QUICK_PAYMENT_AMOUNT_INPUT_ID}>
              المبلغ المقبوض
            </label>
            <Input
              id={QUICK_PAYMENT_AMOUNT_INPUT_ID}
              ref={amountInputRef}
              type="number"
              min="0.01"
              inputMode="decimal"
              step="0.01"
              placeholder="المبلغ"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
            {amountValidationMessage ? <p className="mt-2 text-sm text-destructive">{amountValidationMessage}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">تاريخ الدفع</label>
            <Input type="date" value={paymentDate} onChange={(event) => onPaymentDateChange(event.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">المرجع (اختياري)</label>
            <Input placeholder="رقم الشيك أو التحويل" value={reference} onChange={(event) => onReferenceChange(event.target.value)} />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" size="lg" disabled={isPaymentDisabled}>
            {isPending ? 'جارٍ التسجيل...' : 'تسجيل دفعة'}
          </Button>
        </div>
      </form>
    </div>
  );
}