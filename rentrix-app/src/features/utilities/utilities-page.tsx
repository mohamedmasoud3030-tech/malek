import { useMemo, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Droplets, Flame, Plus, Printer, ShieldCheck, Wifi, Zap, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AsyncContentState } from '@/components/async-content-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { useProperties } from '@/features/properties/use-properties';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { useUtilityBills, useUtilityMeters, useCreateUtilityMeter, useCreateUtilityBill, useDeleteUtilityMeter, useDeleteUtilityBill } from './use-utilities';
import { responsiblePartyLabels, utilityBillStatusLabels, utilityTypeLabels, type UtilityBillStatus, type UtilityMeterFormValues, type UtilityBillFormValues, type UtilityType, type ResponsibleParty } from './utilities-service';

const defaultSettings: DocumentSettings = {
  company: { name: 'رينتريكس لإدارة العقارات', address: 'سلطنة عمان - مسقط', phone: '+968 24000000' },
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
  const [statusFilter, setStatusFilter] = useState<UtilityBillStatus | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showMeterDialog, setShowMeterDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);

  const [meterForm, setMeterForm] = useState<UtilityMeterFormValues>({
    property_id: '',
    utility_type: 'electricity',
    meter_number: '',
    account_number: '',
    provider_name: '',
    responsible_party: 'tenant',
    is_active: true,
    notes: '',
  });

  const [billForm, setBillForm] = useState<UtilityBillFormValues>({
    property_id: '',
    meter_id: null,
    amount: 0,
    due_date: getTodayLocalDateString(),
    responsible_party: 'tenant',
    billing_period_start: null,
    billing_period_end: null,
    bill_number: '',
    notes: '',
  });

  const propertiesQuery = useProperties({ page: 1, pageSize: 100, search: '', status: 'all' });
  const metersQuery = useUtilityMeters(propertyFilter !== 'all' ? propertyFilter : undefined);
  const billsQuery = useUtilityBills({
    propertyId: propertyFilter !== 'all' ? propertyFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    meterId: utilityFilter !== 'all' && utilityFilter.startsWith('meter:') ? utilityFilter.replace('meter:', '') : undefined,
  });

  const createMeterMut = useCreateUtilityMeter();
  const createBillMut = useCreateUtilityBill();
  const deleteMeterMut = useDeleteUtilityMeter();
  const deleteBillMut = useDeleteUtilityBill();

  const meters = metersQuery.data ?? [];
  const bills = billsQuery.data ?? [];

  const filteredBills = useMemo(() => {
    let list = bills;
    if (utilityFilter !== 'all' && !utilityFilter.startsWith('meter:')) {
      list = list.filter((b) => {
        const meter = meters.find((m) => m.id === b.meter_id);
        return meter?.utility_type === utilityFilter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((b) => (b.bill_number?.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q)));
    }
    return list;
  }, [bills, meters, utilityFilter, searchQuery]);

  const totalBilled = useMemo(() => filteredBills.reduce((acc, b) => acc + b.amount, 0), [filteredBills]);
  const totalPaid = useMemo(() => filteredBills.reduce((acc, b) => acc + b.paid_amount, 0), [filteredBills]);
  const totalUnpaid = totalBilled - totalPaid;

  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];
    if (propertyFilter !== 'all') {
      const prop = propertiesQuery.data?.rows?.find((p: any) => p.id === propertyFilter);
      items.push({ key: 'property', label: 'العقار', value: prop?.title ?? propertyFilter, onRemove: () => setPropertyFilter('all') });
    }
    if (utilityFilter !== 'all') {
      const label = utilityFilter.startsWith('meter:') ? 'عداد محدد' : utilityTypeLabels[utilityFilter as UtilityType] ?? utilityFilter;
      items.push({ key: 'utility', label: 'المرفق', value: label, onRemove: () => setUtilityFilter('all') });
    }
    if (statusFilter !== 'all') {
      items.push({ key: 'status', label: 'الحالة', value: utilityBillStatusLabels[statusFilter], onRemove: () => setStatusFilter('all') });
    }
    if (searchQuery.trim()) {
      items.push({ key: 'search', label: 'بحث', value: searchQuery, onRemove: () => setSearchQuery('') });
    }
    return items;
  }, [propertyFilter, utilityFilter, statusFilter, searchQuery, propertiesQuery.data]);

  const handleCreateMeter = async () => {
    try {
      await createMeterMut.mutateAsync(meterForm);
      setShowMeterDialog(false);
      setMeterForm({ property_id: '', utility_type: 'electricity', meter_number: '', account_number: '', provider_name: '', responsible_party: 'tenant', is_active: true, notes: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateBill = async () => {
    try {
      await createBillMut.mutateAsync(billForm);
      setShowBillDialog(false);
      setBillForm({ property_id: '', meter_id: null, amount: 0, due_date: getTodayLocalDateString(), responsible_party: 'tenant', billing_period_start: null, billing_period_end: null, bill_number: '', notes: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    const today = getTodayLocalDateString();
    DocumentTemplates.printReportDocument(
      {
        reportTitle: 'كشف مطالبات وقراءات المرافق',
        reportType: 'Property_Utilities_Statement',
        periodFrom: today,
        periodTo: today,
        sections: [
          {
            title: 'جدول فواتير المرافق',
            rows: filteredBills.map((b) => ({
              label: `فاتورة ${b.bill_number || b.id.slice(0, 8)}`,
              value: `المبلغ: ${b.amount} ر.ع | المسدد: ${b.paid_amount} | المسؤول: ${responsiblePartyLabels[b.responsible_party]} | الاستحقاق: ${b.due_date}`,
            })),
            totals: ['إجمالي المطالبات', `${totalBilled} ر.ع`],
          },
        ],
        totalSummary: `الإجمالي: ${totalBilled} ر.ع | المسدد: ${totalPaid} ر.ع | المتبقي: ${totalUnpaid} ر.ع`,
      },
      defaultSettings,
    );
  };

  const isLoading = metersQuery.isLoading || billsQuery.isLoading;
  const isError = metersQuery.isError || billsQuery.isError;
  const error = (metersQuery.error as Error) || (billsQuery.error as Error);

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="إدارة المرافق والعدادات"
        description="إدارة حقيقية لعدادات الكهرباء والمياه والخدمات مع ربط العقار والوحدة وتسجيل القراءات والفواتير."
        primaryAction={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handlePrint} className="min-h-11 gap-2 font-bold">
              <Printer className="size-4 text-primary" aria-hidden="true" />
              طباعة كشف المرافق A4
            </Button>
          </div>
        }
      />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="العدادات المسجلة" value={meters.length.toLocaleString('ar')} icon={Zap} accent="primary" sub="عدادات نشطة" />
        <KpiCard label="إجمالي الفواتير" value={formatMoney(totalBilled)} icon={Activity} accent="sky" sub="مطالبات مسجلة" />
        <KpiCard label="المسدد" value={formatMoney(totalPaid)} icon={CheckCircle2} accent="emerald" sub="مدفوعات" />
        <KpiCard label="المتبقي" value={formatMoney(totalUnpaid)} icon={AlertCircle} accent="rose" sub="مستحق" />
      </ResponsiveCardGrid>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="بحث برقم الفاتورة أو الملاحظات..."
        searchAriaLabel="بحث في فواتير المرافق"
        filters={
          <>
            <Select aria-label="العقار" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="w-full sm:w-44">
              <option value="all">كل العقارات</option>
              {propertiesQuery.data?.rows?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
            <Select aria-label="نوع المرفق" value={utilityFilter} onChange={(e) => setUtilityFilter(e.target.value)} className="w-full sm:w-44">
              <option value="all">كل أنواع المرافق</option>
              <option value="electricity">كهرباء</option>
              <option value="water">مياه</option>
              <option value="gas">غاز</option>
              <option value="internet">إنترنت</option>
              <option value="sanitation">صرف صحي</option>
              <optgroup label="حسب العداد">
                {meters.map((m) => (
                  <option key={m.id} value={`meter:${m.id}`}>
                    {utilityTypeLabels[m.utility_type]} - {m.meter_number}
                  </option>
                ))}
              </optgroup>
            </Select>
            <Select aria-label="حالة السداد" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full sm:w-36">
              <option value="all">كل الحالات</option>
              <option value="unpaid">مستحقة</option>
              <option value="partially_paid">جزئية</option>
              <option value="paid">مسددة</option>
            </Select>
          </>
        }
        actions={
          <div className="flex gap-2 w-full sm:w-auto">
            <Dialog open={showMeterDialog} onOpenChange={setShowMeterDialog}>
              <DialogTrigger asChild>
                <Button className="min-h-11 w-full sm:w-auto gap-2">
                  <Plus className="size-4" />
                  إضافة عداد
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>إضافة عداد مرافق جديد</DialogTitle>
                  <DialogDescription>املأ بيانات العداد وربطه بالعقار والوحدة.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label>العقار *</Label>
                    <Select value={meterForm.property_id} onChange={(e) => setMeterForm((f) => ({ ...f, property_id: e.target.value }))}>
                      <option value="">اختر العقار</option>
                      {propertiesQuery.data?.rows?.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>نوع المرفق *</Label>
                      <Select value={meterForm.utility_type} onChange={(e) => setMeterForm((f) => ({ ...f, utility_type: e.target.value as UtilityType }))}>
                        <option value="electricity">كهرباء</option>
                        <option value="water">مياه</option>
                        <option value="gas">غاز</option>
                        <option value="internet">إنترنت</option>
                        <option value="sanitation">صرف صحي</option>
                        <option value="other">أخرى</option>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>المسؤول *</Label>
                      <Select value={meterForm.responsible_party} onChange={(e) => setMeterForm((f) => ({ ...f, responsible_party: e.target.value as ResponsibleParty }))}>
                        <option value="tenant">المستأجر</option>
                        <option value="landlord">المالك</option>
                        <option value="company">المكتب</option>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>رقم العداد *</Label>
                      <Input value={meterForm.meter_number} onChange={(e) => setMeterForm((f) => ({ ...f, meter_number: e.target.value }))} placeholder="E-123456" />
                    </div>
                    <div className="grid gap-2">
                      <Label>رقم الحساب *</Label>
                      <Input value={meterForm.account_number} onChange={(e) => setMeterForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="ACC-123" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>مزود الخدمة</Label>
                    <Input value={meterForm.provider_name || ''} onChange={(e) => setMeterForm((f) => ({ ...f, provider_name: e.target.value }))} placeholder="شركة كهرباء مسقط" />
                  </div>
                  <div className="grid gap-2">
                    <Label>ملاحظات</Label>
                    <Textarea value={meterForm.notes || ''} onChange={(e) => setMeterForm((f) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية..." />
                  </div>
                  {createMeterMut.isError && <p className="text-sm text-destructive">{(createMeterMut.error as Error)?.message}</p>}
                  <Button onClick={handleCreateMeter} disabled={createMeterMut.isPending} className="min-h-11">
                    {createMeterMut.isPending ? 'جارٍ الحفظ...' : 'حفظ العداد'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="min-h-11 w-full sm:w-auto gap-2">
                  <Plus className="size-4" />
                  فاتورة مرافق
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>إضافة فاتورة مرافق</DialogTitle>
                  <DialogDescription>سجل قراءة استهلاك ومبلغ مستحق.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>العقار *</Label>
                      <Select value={billForm.property_id} onChange={(e) => setBillForm((f) => ({ ...f, property_id: e.target.value }))}>
                        <option value="">اختر العقار</option>
                        {propertiesQuery.data?.rows?.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>العداد</Label>
                      <Select value={billForm.meter_id || ''} onChange={(e) => setBillForm((f) => ({ ...f, meter_id: e.target.value || null }))}>
                        <option value="">بدون عداد محدد</option>
                        {meters.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.meter_number} - {utilityTypeLabels[m.utility_type]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>السابق</Label>
                      <Input type="number" value={billForm.previous_reading ?? ''} onChange={(e) => setBillForm((f) => ({ ...f, previous_reading: e.target.value ? Number(e.target.value) : null }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>الحالي</Label>
                      <Input type="number" value={billForm.current_reading ?? ''} onChange={(e) => setBillForm((f) => ({ ...f, current_reading: e.target.value ? Number(e.target.value) : null }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>الاستهلاك</Label>
                      <Input type="number" value={billForm.consumption_units ?? ''} onChange={(e) => setBillForm((f) => ({ ...f, consumption_units: e.target.value ? Number(e.target.value) : null }))} placeholder="تلقائي" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>المبلغ *</Label>
                      <Input type="number" step="0.001" value={billForm.amount} onChange={(e) => setBillForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>تاريخ الاستحقاق *</Label>
                      <Input type="date" value={billForm.due_date} onChange={(e) => setBillForm((f) => ({ ...f, due_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>المسؤول</Label>
                      <Select value={billForm.responsible_party} onChange={(e) => setBillForm((f) => ({ ...f, responsible_party: e.target.value as ResponsibleParty }))}>
                        <option value="tenant">المستأجر</option>
                        <option value="landlord">المالك</option>
                        <option value="company">المكتب</option>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>رقم الفاتورة</Label>
                      <Input value={billForm.bill_number || ''} onChange={(e) => setBillForm((f) => ({ ...f, bill_number: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>ملاحظات</Label>
                    <Textarea value={billForm.notes || ''} onChange={(e) => setBillForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                  {createBillMut.isError && <p className="text-sm text-destructive">{(createBillMut.error as Error)?.message}</p>}
                  <Button onClick={handleCreateBill} disabled={createBillMut.isPending} className="min-h-11">
                    {createBillMut.isPending ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <ActiveFilterBar filters={activeFilters} onClearAll={() => { setPropertyFilter('all'); setUtilityFilter('all'); setStatusFilter('all'); setSearchQuery(''); }} />

      <AsyncContentState
        status={isLoading ? 'loading' : isError ? 'error' : meters.length === 0 && filteredBills.length === 0 ? 'empty' : 'ready'}
        error={error}
        errorTitle="تعذر تحميل بيانات المرافق"
        errorAction={<Button onClick={() => { metersQuery.refetch(); billsQuery.refetch(); }}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد عدادات أو فواتير مرافق"
        emptyDescription="ابدأ بإضافة عداد مرافق جديد (كهرباء، مياه، غاز) ثم سجل فواتير الاستهلاك الشهرية."
        emptyAction={
          <div className="flex gap-2">
            <Button onClick={() => setShowMeterDialog(true)}>إضافة أول عداد</Button>
          </div>
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-sm font-black">العدادات المسجلة ({meters.length})</CardTitle>
              <CardDescription>قائمة العدادات المرتبطة بالعقارات.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {meters.map((meter) => {
                const IconComp = utilityIcons[meter.utility_type] || Zap;
                return (
                  <div key={meter.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-background p-4">
                    <div className="flex gap-3">
                      <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <IconComp className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <p className="font-bold text-sm">{utilityTypeLabels[meter.utility_type]} - {meter.meter_number}</p>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">{meter.account_number} | {meter.provider_name}</p>
                        <p className="text-xs">المسؤول: <strong>{responsiblePartyLabels[meter.responsible_party]}</strong> {meter.is_active ? '' : '· غير نشط'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label="حذف العداد" onClick={() => deleteMeterMut.mutate(meter.id)} disabled={deleteMeterMut.isPending}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {meters.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد عدادات.</p>}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="border-b border-border/60">
              <CardTitle className="text-sm font-black">فواتير المرافق ({filteredBills.length})</CardTitle>
              <CardDescription>سجل الاستهلاك والمبالغ المستحقة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {filteredBills.map((bill) => (
                <div key={bill.id} className="space-y-2 rounded-2xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-2 border-b pb-2">
                    <span className="font-bold text-sm">فاتورة {bill.bill_number || bill.id.slice(0, 8)}</span>
                    <StatusBadge tone={bill.status === 'paid' ? 'success' : bill.status === 'partially_paid' ? 'warning' : 'danger'}>{utilityBillStatusLabels[bill.status]}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>المبلغ: <strong className="text-foreground">{formatMoney(bill.amount)}</strong></div>
                    <div>المسدد: <strong className="text-foreground">{formatMoney(bill.paid_amount)}</strong></div>
                    <div>الاستحقاق: <strong className="text-foreground">{bill.due_date}</strong></div>
                    <div>المسؤول: <strong className="text-foreground">{responsiblePartyLabels[bill.responsible_party]}</strong></div>
                    {bill.consumption_units != null && <div className="col-span-2">الاستهلاك: <strong className="text-foreground">{bill.consumption_units} وحدة</strong> {bill.previous_reading != null && `(${bill.previous_reading} → ${bill.current_reading})`}</div>}
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" aria-label="حذف فاتورة المرافق" onClick={() => deleteBillMut.mutate(bill.id)} disabled={deleteBillMut.isPending}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              ))}
              {filteredBills.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد فواتير تطابق الفلاتر.</p>}
            </CardContent>
          </Card>
        </div>
      </AsyncContentState>
    </PageLayout>
  );
}

export default UtilitiesPage;
