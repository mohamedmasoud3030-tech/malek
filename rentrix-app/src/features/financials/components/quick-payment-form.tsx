import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { SelectionCard } from '@/components/ui/selection-card';
import type { Payment } from '@/types/domain';
import { QUICK_PAYMENT_AMOUNT_INPUT_ID, QUICK_PAYMENT_FORM_ID } from '../invoices/quick-collect';
import { formatMoney } from './financials-formatters';
import { toFinancialNumber } from '../financialMath';

// RC1 has authoritative control accounts only for physical cash (1111) and
// bank transfer (1120). Do not present card/check/other until a controlled
// clearing-account policy exists; the server rejects those methods too.
const methods: Payment['payment_method'][] = ['cash', 'bank_transfer'];

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
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="gap-3 border-b border-border/60 bg-muted/20 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">تسجيل دفعة سريعة</CardTitle>
        {typeof remainingAmount === 'number' && remainingAmount > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-bold text-foreground">
            <span>المبلغ المتبقي للتحصيل:</span>
            <span className="font-extrabold tabular-nums text-primary">{formatMoney(remainingAmount)}</span>
            <Button
              type="button"
              size="sm"
              variant="soft"
              onClick={() => onAmountChange(String(toFinancialNumber(remainingAmount)))}
            >
              كامل المتبقي
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-3 sm:p-4">
        <EntityForm.Root id={QUICK_PAYMENT_FORM_ID} aria-busy={isPending} onSubmit={onSubmit}>
          <EntityForm.Section title="طريقة الدفع">
            <div className="grid grid-cols-2 gap-2">
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
          </EntityForm.Section>

          <EntityForm.Section title="بيانات الدفعة">
            <div className="grid items-start gap-3 sm:grid-cols-3">
              <EntityForm.Field label="المبلغ المقبوض" error={amountValidationMessage || undefined}>
                <Input
                  id={QUICK_PAYMENT_AMOUNT_INPUT_ID}
                  ref={amountInputRef}
                  type="number"
                  min="0.001"
                  inputMode="decimal"
                  step="0.001"
                  placeholder="المبلغ"
                  value={amount}
                  aria-invalid={Boolean(amountValidationMessage)}
                  onChange={(event) => onAmountChange(event.target.value)}
                />
              </EntityForm.Field>

              <EntityForm.Field label="تاريخ الدفع">
                <Input
                  id="quick-payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(event) => onPaymentDateChange(event.target.value)}
                />
              </EntityForm.Field>

              <EntityForm.Field label="المرجع (اختياري)">
                <Input
                  id="quick-payment-reference"
                  placeholder="رقم التحويل أو الإيداع"
                  value={reference}
                  onChange={(event) => onReferenceChange(event.target.value)}
                />
              </EntityForm.Field>
            </div>
          </EntityForm.Section>

          <EntityForm.Actions
            submitLabel="تسجيل دفعة"
            isSubmitting={isPending}
            submitDisabled={isPaymentDisabled}
          />
        </EntityForm.Root>
      </CardContent>
    </Card>
  );
}
