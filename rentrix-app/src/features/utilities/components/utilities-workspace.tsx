import { useMemo, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Download, Droplets, Flame, Plus, Printer, ShieldCheck, Wifi, Zap, Edit, Trash2 } from 'lucide-react';
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
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { useUtilityBills, useUtilityMeters, useCreateUtilityMeter, useCreateUtilityBill, useDeleteUtilityMeter, useDeleteUtilityBill } from '../use-utilities';
import { responsiblePartyLabels, utilityBillStatusLabels, utilityTypeLabels, type UtilityBill, type UtilityBillStatus, type UtilityMeterFormValues, type UtilityBillFormValues, type UtilityType, type ResponsibleParty } from '../utilities-service';
import { formatLatinNumber } from '@/lib/formatters';

const utilityIcons: Record<UtilityType, typeof Zap> = {
  electricity: Zap,
  water: Droplets,
  sanitation: Activity,
  internet: Wifi,
  gas: Flame,
  other: ShieldCheck,
};


function utilityBillStatusTone(status: UtilityBillStatus): 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success';
  if (status === 'partially_paid') return 'warning';
  return 'danger';
}

export type UtilitiesWorkspaceMode = 'standalone' | 'embedded';

export type UtilitiesWorkspaceProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) —
   * used by the legacy /utilities route when visited directly.
   * embedded: renders only the workspace body — used inside the operations
   * hub, which already supplies its own page shell and section header.
   */
  mode?: UtilitiesWorkspaceMode;
}>;

/**
 * Owns all utilities workspace UI: KPI summary, meter/bill dialogs, filters,
 * and lists. Shared verbatim between the standalone /utilities route and the
 * embedded operations hub tab so business logic, queries, and mutations are
 * never duplicated.
 */
export function UtilitiesWorkspace({ mode = 'standalone' }: UtilitiesWorkspaceProps) {
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
    meter_id: null,
    property_id: '',
    unit_id: null,
    amount: 1,
    paid_amount: 0,
    previous_reading: null,
    current_reading: null,
    consumption_units: null,
    due_date: getTodayLocalDateString(),
    responsible_party: 'tenant',
    billing_period_start: null,
    billing_period_end: null,
    bill_number: null,
    notes: null,
    attachment_url: null,
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
  const documentSettings = useDocumentSettings();

  // The bill the user asked to remove. The first click only stages it here and
  // opens the confirmation dialog — the mutation runs only after an explicit
  // confirm, so a stray tap can never delete a bill.
  const [billToArchive, setBillToArchive] = useState<UtilityBill | null>(null);

  const meters = metersQuery.data ?? [];
  const bills = billsQuery.data ?? [];

  const archiveBillMutationPending = deleteBillMut.isPending;

  const handleConfirmArchiveBill = () => {
    if (!billToArchive || archiveBillMutationPending) return;
    deleteBillMut.mutate(billToArchive.id, {
      onSuccess: () => {
        toast.success('تمت أرشفة فاتورة المرافق وإزالتها من القائمة');
        setBillToArchive(null);
      },
      onError: (error) => {
        toast.error(error instanceof Error && error.message ? error.message : 'تعذر أرشفة فاتورة المرافق');
      },
    });
  };

  // Human-readable context shown inside the archive confirmation so the user
  // can verify exactly which bill is about to be removed.
  const archiveUtilityLabel = (bill: UtilityBill) => {
    const meter = meters.find((m) => m.id === bill.meter_id);
    return meter ? utilityTypeLabels[meter.utility_type] : 'مرفق غير محدد';
  };
  const archivePropertyLabel = (bill: UtilityBill) => {
    const prop = propertiesQuery.data?.rows?.find((p: any) => p.id === bill.property_id);
    return prop?.title ?? 'عقار غير محدد';
  };
  const archivePeriodLabel = (bill: UtilityBill) => {
    if (bill.billing_period_start && bill.billing_period_end) {
      return `${bill.billing_period_start} → ${bill.billing_period_end}`;
    }
    return bill.due_date;
  };

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
      setBillForm({
        meter_id: null,
        property_id: '',
        unit_id: null,
        amount: 1,
        paid_amount: 0,
        previous_reading: null,
        current_reading: null,
        consumption_units: null,
        due_date: getTodayLocalDateString(),
        responsible_party: 'tenant',
        billing_period_start: null,
        billing_period_end: null,
        bill_number: null,
        notes: null,
        attachment_url: null,
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Real currency label for the printed amounts — sourced from company
  // settings, never a hardcoded symbol. Only used once settings are ready.
  const currencyLabel = documentSettings.companySettings.currencySymbol || documentSettings.companySettings.currency;

  const buildUtilitiesReport = () => {
    const today = getTodayLocalDateString();
    return {
      reportTitle: 'كشف مطالبات وقراءات المرافق',
      reportType: 'Property_Utilities_Statement',
      periodFrom: today,
      periodTo: today,
      sections: [
        {
          title: 'جدول فواتير المرافق',
          rows: filteredBills.map((b) => ({
            label: `فاتورة ${b.bill_number || b.id.slice(0, 8)}`,
            value: `المبلغ: ${b.amount} ${currencyLabel} | المسدد: ${b.paid_amount} | المسؤول: ${responsiblePartyLabels[b.responsible_party]} | الاستحقاق: ${b.due_date}`,
          })),
          totals: ['إجمالي المطالبات', `${totalBilled} ${currencyLabel}`],
        },
      ],
      totalSummary: `الإجمالي: ${totalBilled} ${currencyLabel} | المسدد: ${totalPaid} ${currencyLabel} | المتبقي: ${totalUnpaid} ${currencyLabel}`,
    };
  };

  const handlePrint = () => {
    if (!documentSettings.isReady) return;
    const report = buildUtilitiesReport() satisfies ReportDocumentData;
    void runDocumentAction(
      () => documentService.printDocument('generic_report', { settings: documentSettings.companySettings, payload: toReportDocumentPayload(report) }),
      'تعذرت طباعة كشف المرافق.',
    );
  };

  const handleDownloadPdf = () => {
    if (!documentSettings.isReady) return;
    const report = buildUtilitiesReport() satisfies ReportDocumentData;
    void runDocumentAction(
      () => documentService.downloadDocumentPdf('generic_report', { settings: documentSettings.companySettings, payload: toReportDocumentPayload(report) }),
      'تعذر تنزيل كشف المرافق كملف PDF.',
    );
  };

  const isLoading = metersQuery.isLoading || billsQuery.isLoading;
  const isError = metersQuery.isError || billsQuery.isError;
  const error = (metersQuery.error as Error) || (billsQuery.error as Error);

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={handlePrint} disabled={!documentSettings.isReady} className="min-h-11 gap-2 font-bold">
        <Printer className="size-4 text-primary" aria-hidden="true" />
        طباعة كشف المرافق A4
      </Button>
      <Button type="button" variant="secondary" onClick={handleDownloadPdf} disabled={!documentSettings.isReady} className="min-h-11 gap-2 font-bold">
        <Download className="size-4" aria-hidden="true" />
        تنزيل PDF
      </Button>
    </div>
  );

  const body = (
    <>
      {mode === 'embedded' ? (
        <div className="flex flex-wrap justify-end gap-2">{headerActions}</div>
      ) : null}

      {!documentSettings.isReady && !documentSettings.isLoading ? (
        <DocumentReadinessNotice />
      ) : null}

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="العدادات المسجلة" value={formatLatinNumber(meters.length, 'ar')} icon={Zap} accent="primary" sub="عدادات نشطة" />
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
                    <StatusBadge tone={utilityBillStatusTone(bill.status)}>{utilityBillStatusLabels[bill.status]}</StatusBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>المبلغ: <strong className="text-foreground">{formatMoney(bill.amount)}</strong></div>
                    <div>المسدد: <strong className="text-foreground">{formatMoney(bill.paid_amount)}</strong></div>
                    <div>الاستحقاق: <strong className="text-foreground">{bill.due_date}</strong></div>
                    <div>المسؤول: <strong className="text-foreground">{responsiblePartyLabels[bill.responsible_party]}</strong></div>
                    {bill.consumption_units != null && <div className="col-span-2">الاستهلاك: <strong className="text-foreground">{bill.consumption_units} وحدة</strong> {bill.previous_reading != null && `(${bill.previous_reading} → ${bill.current_reading})`}</div>}
                  </div>
                  <div className="flex justify-end">
                    {/* First click only opens the confirmation dialog — nothing is removed yet. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`أرشفة فاتورة المرافق ${bill.bill_number ?? ''}`.trim()}
                      onClick={() => setBillToArchive(bill)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredBills.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد فواتير تطابق الفلاتر.</p>}
            </CardContent>
          </Card>
        </div>
      </AsyncContentState>

      {/* Archive confirmation — the backend performs a logical delete
          (deleted_at), so the wording is "archive", not permanent deletion. */}
      <ConfirmDialog
        open={Boolean(billToArchive)}
        onOpenChange={(open) => { if (!open) setBillToArchive(null); }}
        title="أرشفة فاتورة المرافق؟"
        description="ستُخفى الفاتورة من القائمة وتبقى محفوظة كسجل أرشيفي. لا يمكن تكرار الإجراء أثناء التنفيذ."
        confirmLabel="تأكيد الأرشفة"
        cancelLabel="إلغاء"
        variant="danger"
        isLoading={archiveBillMutationPending}
        onConfirm={handleConfirmArchiveBill}
      >
        {billToArchive ? (
          <div className="grid gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-5">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">رقم الفاتورة</span>
              <strong>{billToArchive.bill_number ?? '—'}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">نوع المرفق</span>
              <strong>{archiveUtilityLabel(billToArchive)}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">العقار</span>
              <strong>{archivePropertyLabel(billToArchive)}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">المبلغ</span>
              <strong>{formatMoney(billToArchive.amount)}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">الفترة / الاستحقاق</span>
              <strong>{archivePeriodLabel(billToArchive)}</strong>
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );

  if (mode === 'embedded') {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="إدارة المرافق والعدادات"
        description="إدارة حقيقية لعدادات الكهرباء والمياه والخدمات مع ربط العقار والوحدة وتسجيل القراءات والفواتير."
        primaryAction={headerActions}
      />
      {body}
    </PageLayout>
  );
}
