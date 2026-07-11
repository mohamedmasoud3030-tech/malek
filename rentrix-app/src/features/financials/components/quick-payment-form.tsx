import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Payment } from '@/types/domain';

const methods: Payment['payment_method'][] = ['cash', 'bank_transfer', 'card', 'check', 'other'];

const methodLabels: Record<Payment['payment_method'], string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  card: 'بطاقة',
  check: 'شيك',
  other: 'أخرى',
};

type QuickPaymentFormProps = {
  amount: string;
  method: Payment['payment_method'];
  paymentDate: string;
  reference: string;
  amountValidationMessage: string;
  isPending: boolean;
  isPaymentDisabled: boolean;
  onAmountChange: (amount: string) => void;
  onMethodChange: (method: Payment['payment_method']) => void;
  onPaymentDateChange: (paymentDate: string) => void;
  onReferenceChange: (reference: string) => void;
  onPostPayment: () => void;
};

export function QuickPaymentForm({ amount, method, paymentDate, reference, amountValidationMessage, isPending, isPaymentDisabled, onAmountChange, onMethodChange, onPaymentDateChange, onReferenceChange, onPostPayment }: QuickPaymentFormProps) {
  return (
    <div className="rounded-2xl border p-4">
      <h4 className="font-black">تسجيل دفعة سريعة</h4>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-start">
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">المبلغ</label>
          <Input type="number" min="0.01" inputMode="decimal" step="0.01" placeholder="المبلغ" value={amount} onChange={(event) => onAmountChange(event.target.value)} />
          {amountValidationMessage ? <p className="mt-2 text-sm text-destructive">{amountValidationMessage}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">طريقة الدفع</label>
          <Select value={method} onChange={(event) => onMethodChange(event.target.value as Payment['payment_method'])}>
            {methods.map((item) => <option key={item} value={item}>{methodLabels[item]}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">تاريخ الدفع</label>
          <Input type="date" value={paymentDate} onChange={(event) => onPaymentDateChange(event.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">المرجع</label>
          <Input placeholder="اختياري" value={reference} onChange={(event) => onReferenceChange(event.target.value)} />
        </div>
        <Button className="lg:mt-5" onClick={onPostPayment} disabled={isPaymentDisabled}>{isPending ? 'جارٍ التسجيل...' : 'تسجيل دفعة'}</Button>
      </div>
    </div>
  );
}
