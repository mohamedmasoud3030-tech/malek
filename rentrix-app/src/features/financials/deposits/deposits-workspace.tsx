import { useState, useMemo } from 'react';
import { CheckCircle2, DollarSign, FileCheck, MinusCircle, Printer, ShieldAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { numberToArabicWords, OMR_CURRENCY_CONFIG } from '@/lib/numberToArabicWords';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import {
  deductionReasonLabels,
  depositStatusLabels,
  type DepositDeductionPayload,
  type DepositRecord,
  type DepositRefundPayload,
} from './deposit-service';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function DepositsWorkspace() {
  const [deposits, setDeposits] = useState<DepositRecord[]>(() => [
    {
      id: 'dep-101',
      contract_id: 'contract-1',
      tenant_id: 'tenant-1',
      tenant_name: 'أحمد بن علي البوسعيدي',
      property_title: 'برج النيل المكتبي',
      unit_number: 'A-102',
      deposit_amount: 300,
      deducted_amount: 50,
      refunded_amount: 0,
      remaining_amount: 250,
      status: 'held',
      received_date: '2026-01-01',
      notes: 'مبلغ التأمين المحتجز عند توقيع العقد',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'dep-102',
      contract_id: 'contract-2',
      tenant_id: 'tenant-2',
      tenant_name: 'سالم بن حمد الرئيسي',
      property_title: 'مجمع العذيبة السكني',
      unit_number: 'B-304',
      deposit_amount: 200,
      deducted_amount: 0,
      refunded_amount: 200,
      remaining_amount: 0,
      status: 'refunded',
      received_date: '2025-06-01',
      settled_date: '2026-06-01',
      notes: 'تم رد مبلغ التأمين بالكامل عند تسليم الشقة بحالة ممتازة',
      created_at: '2025-06-01T00:00:00.000Z',
    },
  ]);

  const [selectedDeposit, setSelectedDeposit] = useState<DepositRecord | null>(null);
  const [actionType, setActionType] = useState<'deduct' | 'refund' | null>(null);

  const [amountInput, setAmountInput] = useState<number>(0);
  const [reasonInput, setReasonInput] = useState<DepositDeductionPayload['reason']>('maintenance_damage');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<DepositRefundPayload['payment_method']>('bank_transfer');

  const totalDepositsHeld = useMemo(() => deposits.reduce((acc, d) => acc + d.remaining_amount, 0), [deposits]);
  const totalDeductions = useMemo(() => deposits.reduce((acc, d) => acc + d.deducted_amount, 0), [deposits]);
  const totalRefunded = useMemo(() => deposits.reduce((acc, d) => acc + d.refunded_amount, 0), [deposits]);

  const handlePrintDepositVoucher = (d: DepositRecord) => {
    const tafqeetAmount = numberToArabicWords(d.remaining_amount > 0 ? d.remaining_amount : d.deposit_amount, OMR_CURRENCY_CONFIG);
    const todayStr = getTodayLocalDateString();

    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'سند تسوية ومخالصة مبلغ التأمين الإيجاري',
        reportType: 'Tenant_Security_Deposit_Clearance',
        periodFrom: d.received_date,
        periodTo: todayStr,
        sections: [
          {
            title: 'بيانات المستأجر ومبلغ الأمانات المحتجز',
            rows: [
              { label: 'اسم المستأجر الثلاثي', value: d.tenant_name },
              { label: 'العقار والعين المؤجرة', value: `${d.property_title} / ${d.unit_number}` },
              { label: 'مبلغ التأمين الأصلي المسدد', value: `${d.deposit_amount.toLocaleString('ar-OM')} ر.ع` },
              { label: 'إجمالي الخصومات والأضرار', value: `${d.deducted_amount.toLocaleString('ar-OM')} ر.ع` },
              { label: 'الصافي المسترد / المتبقي للمستأجر', value: `${d.remaining_amount.toLocaleString('ar-OM')} ر.ع` },
              { label: 'تفقيط الصافي بالحروف العربية', value: tafqeetAmount },
            ],
            totals: ['صافي تسوية التأمين', `${d.remaining_amount.toLocaleString('ar-OM')} ر.ع`],
          },
        ],
        totalSummary: `تاريخ المخالصة: ${todayStr} | تسوية تأمين الشقة بحالة إخلاء معتمدة قانونياً`,
      },
      defaultSettings,
    );
  };

  const handleApplyDeduction = () => {
    if (!selectedDeposit || amountInput <= 0) return;

    setDeposits((prev) =>
      prev.map((d) => {
        if (d.id !== selectedDeposit.id) return d;
        const newDeduction = d.deducted_amount + amountInput;
        const newRemaining = Math.max(0, d.deposit_amount - newDeduction - d.refunded_amount);
        return {
          ...d,
          deducted_amount: newDeduction,
          remaining_amount: newRemaining,
          status: newRemaining === 0 ? 'forfeited_damage' : 'partially_refunded',
          notes: `خصم ${amountInput} ر.ع بسبب: ${descriptionInput}`,
        };
      }),
    );

    setSelectedDeposit(null);
    setActionType(null);
    setAmountInput(0);
    setDescriptionInput('');
  };

  const handleApplyRefund = () => {
    if (!selectedDeposit || amountInput <= 0) return;

    setDeposits((prev) =>
      prev.map((d) => {
        if (d.id !== selectedDeposit.id) return d;
        const newRefund = d.refunded_amount + amountInput;
        const newRemaining = Math.max(0, d.deposit_amount - d.deducted_amount - newRefund);
        return {
          ...d,
          refunded_amount: newRefund,
          remaining_amount: newRemaining,
          status: newRemaining === 0 ? 'refunded' : 'partially_refunded',
          settled_date: getTodayLocalDateString(),
          notes: `إرجاع ${amountInput} ر.ع للمستأجر via ${paymentMethodInput}`,
        };
      }),
    );

    setSelectedDeposit(null);
    setActionType(null);
    setAmountInput(0);
    setDescriptionInput('');
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-muted/20">
        <CardHeader className="px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-bold">دفتر أمانات وتأمينات المستأجرين (Security Deposit Ledger)</CardTitle>
          <CardDescription>
            تتبع مبالغ التأمين النقدي المحتجزة لكل عقد، وإجراء تسويات الإخلاء والرد أو الخصم المباشر لصالح أضرار الشقة والمتأخرات.
          </CardDescription>
        </CardHeader>
      </Card>

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إلتزام الأمانات المحتجزة" value={formatMoney(totalDepositsHeld)} icon={Wallet} accent="emerald" sub="رصيد واجب الرد أو التسوية" />
        <KpiCard label="إجمالي الخصومات والأضرار" value={formatMoney(totalDeductions)} icon={MinusCircle} accent="rose" sub="نفقات صيانة الشواغر" />
        <KpiCard label="المبالغ المرجعة للمستأجرين" value={formatMoney(totalRefunded)} icon={CheckCircle2} accent="sky" sub="تأمينات ردت بالكامل" />
        <KpiCard label="عدد عقود الأمانة" value={deposits.length.toLocaleString('ar')} icon={FileCheck} accent="primary" sub="سجلات الأمانات" />
      </ResponsiveCardGrid>

      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-bold">جدول الأمانات والخصم والتسويات</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-3">
          {deposits.map((d) => {
            const tone = d.status === 'refunded' ? 'green' : d.status === 'held' ? 'blue' : 'amber';

            return (
              <div key={d.id} className="rounded-2xl border border-border/60 bg-background p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div>
                    <p className="font-bold text-sm">{d.tenant_name}</p>
                    <p className="text-xs text-muted-foreground">{d.property_title} · وحدة {d.unit_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={tone}>{depositStatusLabels[d.status]}</StatusBadge>
                    <Button variant="outline" size="sm" onClick={() => handlePrintDepositVoucher(d)} className="min-h-8 text-xs gap-1">
                      <Printer className="size-3.5 text-primary" />
                      طباعة سند التسوية A4
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-muted/20 p-2">
                    <span className="text-muted-foreground block">مبلغ التأمين المحتجز</span>
                    <strong className="text-foreground text-sm" dir="ltr">{formatMoney(d.deposit_amount)}</strong>
                  </div>
                  <div className="rounded-xl bg-muted/20 p-2">
                    <span className="text-muted-foreground block">الخصومات والأضرار</span>
                    <strong className="text-destructive text-sm" dir="ltr">{formatMoney(d.deducted_amount)}</strong>
                  </div>
                  <div className="rounded-xl bg-muted/20 p-2">
                    <span className="text-muted-foreground block">المبلغ المرجع</span>
                    <strong className="text-emerald-600 text-sm" dir="ltr">{formatMoney(d.refunded_amount)}</strong>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2">
                    <span className="text-muted-foreground block">المتبقي الصافي</span>
                    <strong className="text-primary text-sm" dir="ltr">{formatMoney(d.remaining_amount)}</strong>
                  </div>
                </div>

                {d.remaining_amount > 0 ? (
                  <div className="flex gap-2 pt-1 border-t border-border/40">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setSelectedDeposit(d);
                        setActionType('deduct');
                        setAmountInput(d.remaining_amount);
                      }}
                    >
                      <ShieldAlert className="size-3.5" />
                      خصم أضرار / صيانة من التأمين
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs gap-1"
                      onClick={() => {
                        setSelectedDeposit(d);
                        setActionType('refund');
                        setAmountInput(d.remaining_amount);
                      }}
                    >
                      <DollarSign className="size-3.5" />
                      إرجاع التأمين للمستأجر
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      {selectedDeposit && actionType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-background border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-base">
                {actionType === 'deduct' ? 'خصم أضرار / صيانة من مبلغ التأمين' : 'تسوية ورد مبلغ التأمين للمستأجر'}
              </h3>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedDeposit(null); setActionType(null); }}>
                إلغاء
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-medium text-muted-foreground">
                المستأجر: <strong className="text-foreground">{selectedDeposit.tenant_name}</strong> | المتبقي في الأمانة: <strong className="text-primary font-bold" dir="ltr">{formatMoney(selectedDeposit.remaining_amount)}</strong>
              </p>

              <div>
                <label className="block font-bold mb-1">المبلغ المطلوب {actionType === 'deduct' ? 'خصمه' : 'إرجاعه'} (ر.ع)</label>
                <Input
                  type="number"
                  dir="ltr"
                  max={selectedDeposit.remaining_amount}
                  value={amountInput}
                  onChange={(e) => setAmountInput(Number(e.target.value))}
                />
              </div>

              {actionType === 'deduct' ? (
                <>
                  <div>
                    <label className="block font-bold mb-1">سبب الخصم</label>
                    <Select value={reasonInput} onChange={(e) => setReasonInput(e.target.value as any)}>
                      {Object.entries(deductionReasonLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">تفاصيل الخصم أو الأضرار المسجلة</label>
                    <Textarea
                      placeholder="مثال: إصلاح تلفيات الجدران وتغيير أقفال الشقة..."
                      value={descriptionInput}
                      onChange={(e) => setDescriptionInput(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-bold mb-1">طريقة الدفع والاسترداد</label>
                  <Select value={paymentMethodInput} onChange={(e) => setPaymentMethodInput(e.target.value as any)}>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً</option>
                    <option value="check">شيك مصرفي</option>
                  </Select>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-border/60">
                <Button variant="secondary" onClick={() => { setSelectedDeposit(null); setActionType(null); }}>
                  إلغاء
                </Button>
                <Button
                  onClick={actionType === 'deduct' ? handleApplyDeduction : handleApplyRefund}
                  disabled={amountInput <= 0 || amountInput > selectedDeposit.remaining_amount}
                >
                  تأكيد الخصم والتسوية
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
