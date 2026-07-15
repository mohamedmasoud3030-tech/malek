import { useState, useMemo } from 'react';
import { Activity, AlertCircle, CheckCircle2, Droplets, Flame, Plus, Printer, ShieldCheck, Wifi, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import {
  listUtilityBills,
  listUtilityMeters,
  responsiblePartyLabels,
  utilityBillStatusLabels,
  utilityTypeLabels,
  type UtilityBill,
  type UtilityMeter,
  type UtilityType,
} from './utilities-service';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

const utilityIcons: Record<UtilityType, typeof Zap> = {
  electricity: Zap,
  water: Droplets,
  sanitation: Activity,
  internet: Wifi,
  gas: Flame,
  other: ShieldCheck,
};

export function UtilitiesPage() {
  const [utilityFilter, setUtilityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const metersQuery = listUtilityMeters();
  const billsQuery = listUtilityBills();

  const [meters] = useState<UtilityMeter[]>(() => [
    {
      id: 'meter-1',
      property_id: 'p-1',
      utility_type: 'electricity',
      meter_number: 'E-902148',
      account_number: 'ACC-88123',
      provider_name: 'شركة كهرباء مسقط',
      responsible_party: 'tenant',
      is_active: true,
      notes: 'عداد الكهرباء الرئيسي للبناية',
      created_at: new Date().toISOString(),
    },
    {
      id: 'meter-2',
      property_id: 'p-1',
      utility_type: 'water',
      meter_number: 'W-441209',
      account_number: 'ACC-99411',
      provider_name: 'الهيئة العامة للمياه (نماء)',
      responsible_party: 'tenant',
      is_active: true,
      notes: 'عداد المياه الرئيسي',
      created_at: new Date().toISOString(),
    },
  ]);

  const [bills] = useState<UtilityBill[]>(() => [
    {
      id: 'bill-1',
      meter_id: 'meter-1',
      property_id: 'p-1',
      bill_number: 'INV-2026-001',
      billing_period_start: '2026-06-01',
      billing_period_end: '2026-06-30',
      previous_reading: 14200,
      current_reading: 15150,
      consumption_units: 950,
      amount: 47.5,
      paid_amount: 47.5,
      due_date: '2026-07-15',
      status: 'paid',
      responsible_party: 'tenant',
      notes: 'تم السداد بواسطة التحويل البنكي',
      created_at: new Date().toISOString(),
    },
    {
      id: 'bill-2',
      meter_id: 'meter-2',
      property_id: 'p-1',
      bill_number: 'INV-2026-002',
      billing_period_start: '2026-06-01',
      billing_period_end: '2026-06-30',
      previous_reading: 8100,
      current_reading: 8450,
      consumption_units: 350,
      amount: 18.25,
      paid_amount: 0,
      due_date: '2026-07-25',
      status: 'unpaid',
      responsible_party: 'tenant',
      notes: 'فاتورة مياه شهر يونيو المستحقة',
      created_at: new Date().toISOString(),
    },
  ]);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (utilityFilter !== 'all') {
        const meter = meters.find((m) => m.id === b.meter_id);
        if (meter?.utility_type !== utilityFilter) return false;
      }
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      return true;
    });
  }, [bills, meters, utilityFilter, statusFilter]);

  const totalBilled = useMemo(() => bills.reduce((acc, b) => acc + b.amount, 0), [bills]);
  const totalPaid = useMemo(() => bills.reduce((acc, b) => acc + b.paid_amount, 0), [bills]);
  const totalUnpaid = totalBilled - totalPaid;

  const handlePrintUtilityStatement = () => {
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف مطالبات وقراءات المرافق والخدمات',
        reportType: 'Property_Utilities_Statement',
        periodFrom: new Date().toISOString().slice(0, 10),
        periodTo: new Date().toISOString().slice(0, 10),
        sections: [
          {
            title: 'جدول فواتير المرفقات والعدادات والمسؤول المباشر',
            rows: filteredBills.map((b) => {
              const meter = meters.find((m) => m.id === b.meter_id);
              const typeLabel = meter ? utilityTypeLabels[meter.utility_type] : 'مرفق';
              return {
                label: `فاتورة ${typeLabel} - (حساب #${meter?.account_number || b.bill_number})`,
                value: `المبلغ: ${b.amount.toLocaleString('ar-OM')} ر.ع | الاستهلاك: ${b.consumption_units || '—'} وحدة | المسدد: ${b.paid_amount} ر.ع | المسؤول: ${responsiblePartyLabels[b.responsible_party]}`,
              };
            }),
            totals: ['إجمالي مطالبات المرافق', `${totalBilled.toLocaleString('ar-OM')} ر.ع`],
          },
        ],
        totalSummary: `إجمالي مطالبات المرافق: ${totalBilled.toLocaleString('ar-OM')} ر.ع | غير المسدد: ${totalUnpaid.toLocaleString('ar-OM')} ر.ع`,
      },
      defaultSettings,
    );
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="إدارة المرافق والعدادات"
        description="تتبع عدادات الكهرباء، المياه، والخدمات، وتسجيل القراءات وفواتير الاستهلاك وتكليف المسؤول بالسداد."
        primaryAction={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handlePrintUtilityStatement} className="min-h-11 gap-2 font-bold">
              <Printer className="size-4 text-primary" aria-hidden="true" />
              طباعة كشف المرافق A4
            </Button>
            <Button type="button" className="min-h-11">
              <Plus className="me-2 size-4" aria-hidden="true" />
              إضافة عداد / فاتورة مرافق
            </Button>
          </div>
        }
      />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="عدد العدادات الفعالة" value={meters.length.toLocaleString('ar')} icon={Zap} accent="primary" sub="كهرباء، مياه، غاز" />
        <KpiCard label="إجمالي مبالغ الفواتير" value={formatMoney(totalBilled)} icon={Activity} accent="sky" sub="الفواتير المسجلة" />
        <KpiCard label="المسدد بالكامل" value={formatMoney(totalPaid)} icon={CheckCircle2} accent="emerald" sub="فواتير مسددة" />
        <KpiCard label="المتبقي والمستحق" value={formatMoney(totalUnpaid)} icon={AlertCircle} accent="rose" sub="واجب السداد" />
      </ResponsiveCardGrid>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
        <div className="w-48">
          <Select aria-label="نوع المرفق" value={utilityFilter} onChange={(e) => setUtilityFilter(e.target.value)}>
            <option value="all">كل أنواع المرافق</option>
            <option value="electricity">كهرباء</option>
            <option value="water">مياه</option>
            <option value="gas">غاز</option>
            <option value="internet">إنترنت/اتصالات</option>
          </Select>
        </div>
        <div className="w-48">
          <Select aria-label="حالة السداد" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">كل حالات السداد</option>
            <option value="unpaid">مستحقة السداد</option>
            <option value="paid">مسددة بالكامل</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Active Meters */}
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">العدادات والحسابات المسجلة</CardTitle>
            <CardDescription>قائمة العدادات المرتبطة بالعقارات والوحدات.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-5">
            {meters.map((meter) => {
              const IconComp = utilityIcons[meter.utility_type] || Zap;
              return (
                <div key={meter.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <IconComp className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold text-sm">{utilityTypeLabels[meter.utility_type]} - رقم العداد {meter.meter_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">حساب الخدمة: <span className="font-mono font-bold" dir="ltr">{meter.account_number}</span> | {meter.provider_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">المسؤول عن السداد: <strong className="text-foreground">{responsiblePartyLabels[meter.responsible_party]}</strong></p>
                    </div>
                  </div>
                  <StatusBadge tone="green">نشط</StatusBadge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Utility Bills */}
        <Card className="border-border/60">
          <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
            <CardTitle className="text-sm font-black">سجل فواتير وقراءات الاستهلاك</CardTitle>
            <CardDescription>فواتير الخدمات والاستهلاك مع الحالة وتاريخ الاستحقاق.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 sm:p-5">
            {filteredBills.map((bill) => {
              const meter = meters.find((m) => m.id === bill.meter_id);
              const tone = bill.status === 'paid' ? 'green' : 'red';

              return (
                <div key={bill.id} className="rounded-2xl border border-border/60 bg-background p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <span className="font-bold text-sm">فاتورة #{bill.bill_number} ({utilityTypeLabels[meter?.utility_type ?? 'other']})</span>
                    <StatusBadge tone={tone}>{utilityBillStatusLabels[bill.status]}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                    <div>
                      <span>المبلغ المستحق: </span>
                      <strong className="text-foreground font-black text-sm" dir="ltr">{formatMoney(bill.amount)}</strong>
                    </div>
                    <div>
                      <span>تاريخ الاستحقاق: </span>
                      <strong className="text-foreground">{bill.due_date}</strong>
                    </div>
                    {bill.consumption_units ? (
                      <div className="col-span-2">
                        <span>الاستهلاك: </span>
                        <strong className="text-foreground">{bill.consumption_units} وحدة ({bill.previous_reading} ⬅️ {bill.current_reading})</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {filteredBills.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد فواتير مرافق تطابق الفلاتر.</p> : null}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

export default UtilitiesPage;
