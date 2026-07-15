import { useState, useMemo } from 'react';
import { BadgeCheck, CheckCircle2, DollarSign, FileSpreadsheet, Landmark, Printer, Send, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { numberToArabicWords, OMR_CURRENCY_CONFIG } from '@/lib/numberToArabicWords';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import {
  settlementStatusLabels,
  type OwnerSettlementRecord,
  type ProcessPayoutPayload,
} from '../services/owner-settlements-service';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function OwnerSettlementWorkspace() {
  const [settlements, setSettlements] = useState<OwnerSettlementRecord[]>(() => [
    {
      id: 'settle-801',
      owner_id: 'owner-1',
      owner_name: 'سعود بن محمد الكثيري',
      property_id: 'p-1',
      property_title: 'برج النيل المكتبي',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      gross_rent_collected: 1800,
      management_fee_rate: 5,
      management_fee_type: 'percentage',
      management_fee_amount: 90,
      maintenance_deductions: 120,
      utility_deductions: 0,
      net_payable_amount: 1590,
      status: 'pending',
      created_at: '2026-07-01T00:00:00.000Z',
    },
    {
      id: 'settle-802',
      owner_id: 'owner-2',
      owner_name: 'خالد بن ناصر الهنائي',
      property_id: 'p-2',
      property_title: 'مجمع العذيبة السكني',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      gross_rent_collected: 2400,
      management_fee_rate: 5,
      management_fee_type: 'percentage',
      management_fee_amount: 120,
      maintenance_deductions: 0,
      utility_deductions: 0,
      net_payable_amount: 2280,
      status: 'paid',
      approved_by: 'المدير العام',
      approved_at: '2026-07-02T11:00:00.000Z',
      paid_at: '2026-07-03T14:30:00.000Z',
      payout_reference: 'BANK-00912',
      notes: 'تم التحويل لحساب المالك البنكي المعتمد',
      created_at: '2026-07-01T00:00:00.000Z',
    },
  ]);

  const [selectedSettlement, setSelectedSettlement] = useState<OwnerSettlementRecord | null>(null);
  const [payoutRef, setPayoutRef] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<ProcessPayoutPayload['payout_method']>('bank_transfer');

  const totalGrossCollected = useMemo(() => settlements.reduce((acc, s) => acc + s.gross_rent_collected, 0), [settlements]);
  const totalManagementCommissions = useMemo(() => settlements.reduce((acc, s) => acc + s.management_fee_amount, 0), [settlements]);
  const totalDeductions = useMemo(() => settlements.reduce((acc, s) => acc + s.maintenance_deductions + s.utility_deductions, 0), [settlements]);
  const totalNetPayable = useMemo(() => settlements.reduce((acc, s) => acc + s.net_payable_amount, 0), [settlements]);

  const handlePrintSettlementVoucher = (s: OwnerSettlementRecord) => {
    const tafqeetAmount = numberToArabicWords(s.net_payable_amount, OMR_CURRENCY_CONFIG);

    DocumentTemplates.renderOwnerStatementPdf(
      {
        ownerName: s.owner_name,
        periodFrom: s.period_start,
        periodTo: s.period_end,
        propertyTitle: s.property_title,
        totalRent: s.gross_rent_collected,
        totalExpenses: s.maintenance_deductions + s.utility_deductions,
        totalCommission: s.management_fee_amount,
        netAmount: s.net_payable_amount,
        transactions: [
          {
            date: s.period_start,
            type: 'إيجارات مقبوضة',
            description: `تحصيلات إيجارات ${s.property_title}`,
            amount: s.gross_rent_collected,
          },
          {
            date: s.period_end,
            type: 'عمولة إدارة إيجارات',
            description: `عمولة إدارة أملاك بنسبة ${s.management_fee_rate}%`,
            amount: -s.management_fee_amount,
          },
          ...(s.maintenance_deductions > 0
            ? [
                {
                  date: s.period_end,
                  type: 'استقطاع صيانة',
                  description: 'مصروفات صيانة تشغيلية للعقار',
                  amount: -s.maintenance_deductions,
                },
              ]
            : []),
        ],
      },
      defaultSettings,
    );
  };

  const handleApprove = (s: OwnerSettlementRecord) => {
    setSettlements((prev) =>
      prev.map((item) =>
        item.id === s.id
          ? {
              ...item,
              status: 'approved',
              approved_by: 'مدير النظام',
              approved_at: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  const handleExecutePayout = () => {
    if (!selectedSettlement || !payoutRef.trim()) return;

    setSettlements((prev) =>
      prev.map((item) =>
        item.id === selectedSettlement.id
          ? {
              ...item,
              status: 'paid',
              paid_at: new Date().toISOString(),
              payout_reference: payoutRef,
              notes: `تم تحويل المبلغ لمالك العقار مرجع #${payoutRef}`,
            }
          : item,
      ),
    );

    setSelectedSettlement(null);
    setPayoutRef('');
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-muted/20">
        <CardHeader className="px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-bold">مركز تسويات ومحاسبة الملاك (Landlord Settlement Hub)</CardTitle>
          <CardDescription>
            احتساب نسب وعمولات إدارة الأملاك آلياً من إجمالي التحصيلات الفعالية، وخصم تكاليف الصيانة واعتماد وصرف أرباح الملاك.
          </CardDescription>
        </CardHeader>
      </Card>

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المقبوضات" value={formatMoney(totalGrossCollected)} icon={Wallet} accent="emerald" sub="إيجارات حصلت من المستأجرين" />
        <KpiCard label="عمولات الإدارة المكتسبة" value={formatMoney(totalManagementCommissions)} icon={Landmark} accent="primary" sub="إيراد عمولة المكتب" />
        <KpiCard label="خصومات الصيانة والنفقات" value={formatMoney(totalDeductions)} icon={DollarSign} accent="rose" sub="مصاريف مخصومة من المالك" />
        <KpiCard label="صافي مستحقات الملاك" value={formatMoney(totalNetPayable)} icon={BadgeCheck} accent="sky" sub="صافي الأرباح المحولة" />
      </ResponsiveCardGrid>

      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-bold">جدول كشوف وتعميدات أرباح الملاك</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-3">
          {settlements.map((s) => {
            const tone = s.status === 'paid' ? 'green' : s.status === 'approved' ? 'blue' : 'gold';

            return (
              <div key={s.id} className="rounded-2xl border border-border/60 bg-background p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <div>
                    <p className="font-bold text-sm">{s.owner_name}</p>
                    <p className="text-xs text-muted-foreground">{s.property_title} · فترة {s.period_start} إلى {s.period_end}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={tone}>{settlementStatusLabels[s.status]}</StatusBadge>
                    <Button variant="outline" size="sm" onClick={() => handlePrintSettlementVoucher(s)} className="min-h-8 text-xs gap-1">
                      <Printer className="size-3.5 text-primary" />
                      طباعة كشف التسوية A4
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-muted/20 p-2">
                    <span className="text-muted-foreground block">الإيجارات المحصلة</span>
                    <strong className="text-foreground text-sm" dir="ltr">{formatMoney(s.gross_rent_collected)}</strong>
                  </div>
                  <div className="rounded-xl bg-muted/20 p-2">
                    <span className="text-muted-foreground block">عمولة المكتب ({s.management_fee_rate}%)</span>
                    <strong className="text-primary text-sm" dir="ltr">{formatMoney(s.management_fee_amount)}</strong>
                  </div>
                  <div className="rounded-xl bg-muted/20 p-2">
                    <span className="text-muted-foreground block">خصومات المصاريف</span>
                    <strong className="text-destructive text-sm" dir="ltr">{formatMoney(s.maintenance_deductions + s.utility_deductions)}</strong>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-2">
                    <span className="text-muted-foreground block">الصافي المستحق للمالك</span>
                    <strong className="text-emerald-600 text-sm" dir="ltr">{formatMoney(s.net_payable_amount)}</strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                  <span className="text-muted-foreground">
                    {s.approved_by ? `معتمد بواسطة: ${s.approved_by}` : 'في انتظار الاعتماد المالي'}
                    {s.payout_reference ? ` | مرجع التحويل: ${s.payout_reference}` : ''}
                  </span>

                  <div className="flex gap-2">
                    {s.status === 'pending' ? (
                      <Button size="sm" variant="secondary" onClick={() => handleApprove(s)} className="text-xs gap-1">
                        <CheckCircle2 className="size-3.5 text-primary" />
                        اعتماد التسوية
                      </Button>
                    ) : null}

                    {s.status === 'approved' ? (
                      <Button size="sm" onClick={() => setSelectedSettlement(s)} className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Send className="size-3.5" />
                        تسجيل تحويل أرباح المالك
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Payout Dialog */}
      {selectedSettlement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-background border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-base">تسجيل تحويل أرباح المالك للبنك</h3>
              <Button size="sm" variant="ghost" onClick={() => setSelectedSettlement(null)}>
                إلغاء
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-medium text-muted-foreground">
                المالك: <strong className="text-foreground">{selectedSettlement.owner_name}</strong> | الصافي المعتمد: <strong className="text-emerald-600 font-bold" dir="ltr">{formatMoney(selectedSettlement.net_payable_amount)}</strong>
              </p>

              <div>
                <label className="block font-bold mb-1">وسيلة التحويل</label>
                <Select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value as any)}>
                  <option value="bank_transfer">تحويل بنكي مباشر</option>
                  <option value="check">شيك مصرفي</option>
                  <option value="cash">نقداً</option>
                </Select>
              </div>

              <div>
                <label className="block font-bold mb-1">رقم المرجع / المعاملة البنكية</label>
                <Input
                  placeholder="مثال: TR-902184 / CHK-102"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-border/60">
                <Button variant="secondary" onClick={() => setSelectedSettlement(null)}>
                  إلغاء
                </Button>
                <Button onClick={handleExecutePayout} disabled={!payoutRef.trim()}>
                  تأكيد التحويل وإغلاق الكشف
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
