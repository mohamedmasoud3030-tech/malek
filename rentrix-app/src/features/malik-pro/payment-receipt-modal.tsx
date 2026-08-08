/*
 * ============================================
 * MALIK PRO - Payment Receipt Modal
 * سداد الفاتورة وإصدار سند القبض
 * ============================================
 */

import { useState } from 'react';
import { 
  Receipt, 
  Building2, 
  User, 
  Banknote, 
  CreditCard, 
  Money,
  Printer,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  MalikModal,
  MalikButton,
  MalikInput,
  MalikSelect,
  MalikCard,
  MalikCardContent,
  MalikCardHeader,
  MalikInfoCard,
  MalikAmountCard,
  MalikStatusBadge,
  MalikAlert,
  MalikRadioGroup,
} from '@/components/malik-pro';
import type { Invoice, Receipt as ReceiptType } from '@/types/domain';

export interface PaymentReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  tenantName: string;
  propertyTitle: string;
  unitNumber: string;
  onSubmit: (data: PaymentData) => Promise<{ receipt: ReceiptType }>;
  isSubmitting?: boolean;
}

export interface PaymentData {
  invoice_id: string;
  amount: number;
  payment_method: 'bank_transfer' | 'cash' | 'card';
  payment_date: string;
  reference_number?: string;
}

const paymentMethodOptions = [
  {
    value: 'bank_transfer',
    label: 'تحويل بنكي مباشر',
    description: 'التحويل من حساب بنكي',
    icon: <Banknote className="size-5" />,
  },
  {
    value: 'cash',
    label: 'نقداً',
    description: 'الدفع النقدي',
    icon: <Money className="size-5" />,
  },
  {
    value: 'card',
    label: 'بطاقة',
    description: 'بطاقة ائتمان أو خصم',
    icon: <CreditCard className="size-5" />,
  },
];

export function PaymentReceiptModal({
  open,
  onOpenChange,
  invoice,
  tenantName,
  propertyTitle,
  unitNumber,
  onSubmit,
  isSubmitting = false,
}: PaymentReceiptModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentData['payment_method']>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receipt, setReceipt] = useState<ReceiptType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remainingAmount = invoice?.remaining_amount || 0;
  const formattedRemaining = remainingAmount.toLocaleString('ar-OM', { 
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

  const paymentAmount = parseFloat(amount) || 0;
  const isValidAmount = paymentAmount > 0 && paymentAmount <= remainingAmount;

  const handleSubmit = async () => {
    if (!invoice || !isValidAmount) return;

    setError(null);
    try {
      const result = await onSubmit({
        invoice_id: invoice.id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber || undefined,
      });
      setReceipt(result.receipt);
    } catch (err) {
      setError('فشل في تسجيل الدفعة. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleClose = () => {
    setReceipt(null);
    setAmount('');
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber('');
    setError(null);
    onOpenChange(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // If we have a receipt, show the receipt view
  if (receipt) {
    return (
      <MalikModal
        open={open}
        onOpenChange={handleClose}
        title="سند قبض معتمد"
        size="lg"
        footer={
          <div className="flex justify-between items-center w-full">
            <MalikButton
              variant="outline"
              onClick={handleClose}
              leftIcon={<X className="size-4" />}
            >
              إغلاق
            </MalikButton>
            <MalikButton
              variant="primary"
              onClick={handlePrint}
              leftIcon={<Printer className="size-4" />}
            >
              طباعة السند
            </MalikButton>
          </div>
        }
      >
        <div className="print:shadow-none print:border-0">
          {/* Receipt Document */}
          <div 
            data-malik-receipt-card
            className="overflow-hidden rounded-2xl border border-[hsl(var(--malik-border))] shadow-[var(--malik-shadow-card)]"
          >
            {/* Receipt Header */}
            <header 
              data-malik-receipt-header
              className="bg-gradient-to-r from-[hsl(var(--malik-primary))] to-[hsl(var(--malik-primary-dark))] p-6 text-white"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="size-6" />
                    <span className="text-lg font-bold">سند قبض معتمد</span>
                  </div>
                  <p className="text-white/80 text-sm">
                    رقم السند: {receipt.id.slice(0, 12).toUpperCase()}
                  </p>
                  <p className="text-white/80 text-sm">
                    التاريخ: {new Date(receipt.payment_date).toLocaleDateString('ar-OM')}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-white/70">الموقع الرسمي</p>
                  <p className="text-sm font-bold">مالك برو Malik Pro</p>
                  <p className="text-xs text-white/70">للإدارة العقارية</p>
                </div>
              </div>
            </header>

            {/* Receipt Body */}
            <div data-malik-receipt-body className="p-6 space-y-6">
              {/* Payer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-[hsl(var(--malik-muted))] rounded-xl">
                  <User className="size-5 text-[hsl(var(--malik-primary))]" />
                  <div>
                    <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">المستأجر</p>
                    <p className="text-sm font-bold">{tenantName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[hsl(var(--malik-muted))] rounded-xl">
                  <Building2 className="size-5 text-[hsl(var(--malik-primary))]" />
                  <div>
                    <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">العقار والوحدة</p>
                    <p className="text-sm font-bold">{propertyTitle} - {unitNumber}</p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-[hsl(var(--malik-muted))] rounded-xl">
                  <Banknote className="size-5 text-[hsl(var(--malik-info))]" />
                  <div>
                    <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">طريقة الدفع</p>
                    <p className="text-sm font-bold">
                      {paymentMethodOptions.find((m) => m.value === receipt.payment_method)?.label || receipt.payment_method}
                    </p>
                  </div>
                </div>
                {referenceNumber && (
                  <div className="flex items-center gap-3 p-3 bg-[hsl(var(--malik-muted))] rounded-xl">
                    <Receipt className="size-5 text-[hsl(var(--malik-info))]" />
                    <div>
                      <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">رقم المرجع</p>
                      <p className="text-sm font-bold">{referenceNumber}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Amount - Prominent Display */}
              <MalikAmountCard
                amount={receipt.amount.toLocaleString('ar-OM', { minimumFractionDigits: 3 })}
                variant="success"
                label="✓ مسدد وموثق"
                className="text-center"
              />

              {/* Electronic Signature Note */}
              <div className="text-center p-4 bg-[hsl(var(--malik-success-bg))] rounded-xl border border-[hsl(var(--malik-success)/0.2)]">
                <p className="text-sm font-medium text-[hsl(var(--malik-success))]">
                  ✓ تم التوثيق والتوقيع الإلكتروني
                </p>
                <p className="text-xs text-[hsl(var(--malik-foreground-muted))] mt-1">
                  هذا السند صادر ومعتمد من نظام مالك برو Malik Pro
                </p>
              </div>
            </div>

            {/* Receipt Footer */}
            <footer 
              data-malik-receipt-footer
              className="p-4 bg-[hsl(var(--malik-muted))] border-t border-[hsl(var(--malik-border-light))] text-center"
            >
              <p className="text-xs text-[hsl(var(--malik-foreground-muted))]">
                مالك برو Malik Pro - نظام الإدارة العقارية المتكامل
              </p>
            </footer>
          </div>
        </div>
      </MalikModal>
    );
  }

  // Payment Form View
  return (
    <MalikModal
      open={open}
      onOpenChange={handleClose}
      title="سداد الفاتورة وإصدار سند القبض"
      description="تسجيل الدفعة وإنشاء سند قبض رسمي"
      size="lg"
      footer={
        <>
          <MalikButton
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            إلغاء
          </MalikButton>
          <MalikButton
            variant="success"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!isValidAmount}
            leftIcon={<Receipt className="size-4" />}
          >
            {isSubmitting ? 'جارٍ التسجيل...' : 'تأكيد السداد وإصدار السند'}
          </MalikButton>
        </>
      }
    >
      <div className="space-y-6">
        {/* Invoice Summary Card */}
        <MalikCard variant="elevated">
          <MalikCardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[hsl(var(--malik-info-bg))]">
                <Receipt className="size-5 text-[hsl(var(--malik-info))]" />
              </div>
              <div>
                <p className="text-sm font-bold">فاتورة مستحقة</p>
                <p className="text-xs text-[hsl(var(--malik-foreground-muted))]">
                  #{invoice?.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>
            <MalikStatusBadge status="unpaid" />
          </MalikCardHeader>
          <MalikCardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-[hsl(var(--malik-muted))] rounded-xl">
                <User className="size-5 text-[hsl(var(--malik-primary))]" />
                <div>
                  <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">المستأجر</p>
                  <p className="text-sm font-bold">{tenantName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[hsl(var(--malik-muted))] rounded-xl">
                <Building2 className="size-5 text-[hsl(var(--malik-primary))]" />
                <div>
                  <p className="text-[10px] text-[hsl(var(--malik-foreground-muted))]">العقار والوحدة</p>
                  <p className="text-sm font-bold">{propertyTitle} - {unitNumber}</p>
                </div>
              </div>
            </div>

            {/* Remaining Amount - Red Alert */}
            <div className="mt-4 p-4 bg-[hsl(var(--malik-danger-bg))] rounded-xl border border-[hsl(var(--malik-danger)/0.2)]">
              <p className="text-xs font-bold text-[hsl(var(--malik-danger))] mb-1">
                المبلغ المتبقي للpayment
              </p>
              <p className="text-2xl font-black text-[hsl(var(--malik-danger))] malik-num-tabular">
                ر.ع {formattedRemaining}
              </p>
            </div>
          </MalikCardContent>
        </MalikCard>

        {/* Payment Form */}
        <div className="space-y-4">
          <MalikInput
            name="amount"
            label="مبلغ الدفعة الحالية (ر.ع) *"
            type="number"
            placeholder="0.00"
            min="0"
            max={remainingAmount}
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`الحد الأقصى: ر.ع ${formattedRemaining}`}
          />

          <div>
            <label className="block text-sm font-bold mb-3">
              طريقة السداد *
            </label>
            <MalikRadioGroup
              name="payment_method"
              options={paymentMethodOptions}
              value={paymentMethod}
              onChange={(value) => setPaymentMethod(value as PaymentData['payment_method'])}
            />
          </div>

          <MalikInput
            name="payment_date"
            label="تاريخ الدفع *"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          <MalikInput
            name="reference_number"
            label="رقم المرجع / العملية"
            placeholder="رقم الحوالة أو المرجع البنكي (اختياري)"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>

        {/* Error Alert */}
        {error && (
          <MalikAlert variant="danger" dismissible onDismiss={() => setError(null)}>
            {error}
          </MalikAlert>
        )}

        {/* Amount Validation */}
        {amount && !isValidAmount && (
          <MalikAlert variant="warning">
            {paymentAmount > remainingAmount
              ? 'المبلغ المدخل أكبر من المبلغ المتبقي'
              : 'يرجى إدخال مبلغ صحيح'}
          </MalikAlert>
        )}
      </div>
    </MalikModal>
  );
}
