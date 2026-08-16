import { useMemo, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Download, Droplets, Flame, Plus, Printer, ShieldCheck, Trash2, Wifi, Zap } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useProperties } from '@/features/properties/use-properties';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import { formatLatinNumber } from '@/lib/formatters';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { toast } from 'sonner';
import {
  useUtilityBills,
  useUtilityMeters,
  useCreateUtilityMeter,
  useCreateUtilityBill,
  useDeleteUtilityMeter,
  useDeleteUtilityBill,
} from '../use-utilities';
import { MONEY_MIN_POSITIVE, MONEY_STEP } from '@/lib/money';
import {
  responsiblePartyLabels,
  utilityBillStatusLabels,
  utilityTypeLabels,
  type UtilityBill,
  type UtilityBillStatus,
  type UtilityMeter,
  type UtilityMeterFormValues,
  type UtilityBillFormValues,
  type UtilityType,
  type ResponsibleParty,
} from '../utilities-service';

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
export type UtilitiesWorkspaceProps = Readonly<{ mode?: UtilitiesWorkspaceMode }>;

const emptyMeterForm = (): UtilityMeterFormValues => ({
  property_id: '',
  utility_type: 'electricity',
  meter_number: '',
  account_number: '',
  provider_name: '',
  responsible_party: 'tenant',
  is_active: true,
  notes: '',
});

const emptyBillForm = (): UtilityBillFormValues => ({
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

export function UtilitiesWorkspace({ mode = 'standalone' }: UtilitiesWorkspaceProps) {
  const [utilityFilter, setUtilityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<UtilityBillStatus | 'all'>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [showBillForm, setShowBillForm] = useState(false);
  const [meterForm, setMeterForm] = useState<UtilityMeterFormValues>(emptyMeterForm);
  const [billForm, setBillForm] = useState<UtilityBillFormValues>(emptyBillForm);
  const [meterToArchive, setMeterToArchive] = useState<UtilityMeter | null>(null);
  const [billToArchive, setBillToArchive] = useState<UtilityBill | null>(null);

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
  const companySettings = useCompanySettingsContract();

  const meters = metersQuery.data ?? [];
  const bills = billsQuery.data ?? [];
  const properties = propertiesQuery.data?.rows ?? [];
  const propertyName = (propertyId: string) => properties.find((property) => property.id === propertyId)?.title ?? 'عقار غير محدد';
  const money = (value: number) => formatCompanyMoney(companySettings, value);

  const filteredBills = useMemo(() => {
    let list = bills;
    if (utilityFilter !== 'all' && !utilityFilter.startsWith('meter:')) {
      list = list.filter((bill) => meters.find((meter) => meter.id === bill.meter_id)?.utility_type === utilityFilter);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((bill) => bill.bill_number?.toLowerCase().includes(query) || bill.notes?.toLowerCase().includes(query));
    }
    return list;
  }, [bills, meters, utilityFilter, searchQuery]);

  const totalBilled = useMemo(() => filteredBills.reduce((total, bill) => total + bill.amount, 0), [filteredBills]);
  const totalPaid = useMemo(() => filteredBills.reduce((total, bill) => total + bill.paid_amount, 0), [filteredBills]);
  const totalUnpaid = totalBilled - totalPaid;

  const activeFilters = useMemo<ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];
    if (propertyFilter !== 'all') {
      items.push({ key: 'property', label: 'العقار', value: propertyName(propertyFilter), onRemove: () => setPropertyFilter('all') });
    }
    if (utilityFilter !== 'all') {
      const meterId = utilityFilter.startsWith('meter:') ? utilityFilter.replace('meter:', '') : null;
      const label = meterId
        ? `عداد ${meters.find((meter) => meter.id === meterId)?.meter_number ?? 'محدد'}`
        : utilityTypeLabels[utilityFilter as UtilityType] ?? utilityFilter;
      items.push({ key: 'utility', label: 'المرفق', value: label, onRemove: () => setUtilityFilter('all') });
    }
    if (statusFilter !== 'all') {
      items.push({ key: 'status', label: 'الحالة', value: utilityBillStatusLabels[statusFilter], onRemove: () => setStatusFilter('all') });
    }
    if (searchQuery.trim()) {
      items.push({ key: 'search', label: 'بحث', value: searchQuery.trim(), onRemove: () => setSearchQuery('') });
    }
    return items;
  }, [propertyFilter, utilityFilter, statusFilter, searchQuery, meters, properties]);

  const clearFilters = () => {
    setPropertyFilter('all');
    setUtilityFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleCreateMeter = async () => {
    if (!meterForm.property_id || !meterForm.meter_number.trim() || !meterForm.account_number.trim()) return;
    try {
      await createMeterMut.mutateAsync(meterForm);
      setShowMeterForm(false);
      setMeterForm(emptyMeterForm());
    } catch {
      // Mutation exposes its error inside the form.
    }
  };

  const handleCreateBill = async () => {
    if (!billForm.property_id || billForm.amount <= 0 || !billForm.due_date) return;
    try {
      await createBillMut.mutateAsync(billForm);
      setShowBillForm(false);
      setBillForm(emptyBillForm());
    } catch {
      // Mutation exposes its error inside the form.
    }
  };

  const handleConfirmArchiveMeter = () => {
    if (!meterToArchive || deleteMeterMut.isPending) return;
    deleteMeterMut.mutate(meterToArchive.id, {
      onSuccess: () => {
        toast.success('تمت أرشفة العداد');
        setMeterToArchive(null);
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة العداد'),
    });
  };

  const handleConfirmArchiveBill = () => {
    if (!billToArchive || deleteBillMut.isPending) return;
    deleteBillMut.mutate(billToArchive.id, {
      onSuccess: () => {
        toast.success('تمت أرشفة فاتورة المرافق');
        setBillToArchive(null);
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر أرشفة فاتورة المرافق'),
    });
  };

  const currencyLabel = documentSettings.companySettings.currencySymbol || documentSettings.companySettings.currency;
  const buildUtilitiesReport = () => {
    const today = getTodayLocalDateString();
    return {
      reportTitle: 'كشف مطالبات وقراءات المرافق',
      reportType: 'Property_Utilities_Statement',
      periodFrom: today,
      periodTo: today,
      sections: [{
        title: 'جدول فواتير المرافق',
        rows: filteredBills.map((bill) => ({
          label: `فاتورة ${bill.bill_number || 'فاتورة مرافق بلا مرجع'}`,
          value: `المبلغ: ${bill.amount} ${currencyLabel} | المسدد: ${bill.paid_amount} | المسؤول: ${responsiblePartyLabels[bill.responsible_party]} | الاستحقاق: ${bill.due_date}`,
        })),
        totals: ['إجمالي المطالبات', `${totalBilled} ${currencyLabel}`],
      }],
      totalSummary: `الإجمالي: ${totalBilled} ${currencyLabel} | المسدد: ${totalPaid} ${currencyLabel} | المتبقي: ${totalUnpaid} ${currencyLabel}`,
    };
  };

  const handlePrint = () => {
    // Guard inside the async boundary so the handler fails closed with a
    // visible Arabic reason rather than silently doing nothing.
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => {
        const report = buildUtilitiesReport() satisfies ReportDocumentData;
        return documentService.printDocument('generic_report', { settings: documentSettings.companySettings, payload: toReportDocumentPayload(report) });
      },
      fallbackMessage: 'تعذرت طباعة كشف المرافق.',
    });
  };

  const handleDownloadPdf = () => {
    // Guard inside the async boundary so the handler fails closed with a
    // visible Arabic reason rather than silently doing nothing.
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady,
      operation: () => {
        const report = buildUtilitiesReport() satisfies ReportDocumentData;
        return documentService.downloadDocumentPdf('generic_report', { settings: documentSettings.companySettings, payload: toReportDocumentPayload(report) });
      },
      fallbackMessage: 'تعذر تنزيل كشف المرافق كملف PDF.',
    });
  };

  const isLoading = metersQuery.isLoading || billsQuery.isLoading || propertiesQuery.isLoading;
  const error = metersQuery.error ?? billsQuery.error ?? propertiesQuery.error;
  const isError = Boolean(error);

  const meterColumns: ColumnDef<UtilityMeter>[] = [
    {
      key: 'meter',
      header: 'العداد',
      render: (meter) => {
        const Icon = utilityIcons[meter.utility_type];
        return (
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span>
            <div><p className="font-bold">{utilityTypeLabels[meter.utility_type]} · {meter.meter_number}</p><p className="text-xs text-muted-foreground">{meter.provider_name || 'مزود غير محدد'}</p></div>
          </div>
        );
      },
    },
    { key: 'property', header: 'العقار', render: (meter) => propertyName(meter.property_id) },
    { key: 'account', header: 'رقم الحساب', render: (meter) => <span dir="ltr" className="tabular-nums">{meter.account_number}</span> },
    { key: 'responsible', header: 'المسؤول', render: (meter) => responsiblePartyLabels[meter.responsible_party] },
    { key: 'status', header: 'الحالة', render: (meter) => <StatusBadge tone={meter.is_active ? 'success' : 'neutral'}>{meter.is_active ? 'نشط' : 'غير نشط'}</StatusBadge> },
    {
      key: 'actions',
      header: 'إجراء',
      render: (meter) => (
        <Button variant="danger" size="sm" aria-label={`أرشفة العداد ${meter.meter_number}`} onClick={() => setMeterToArchive(meter)}>
          <Trash2 className="size-4" />أرشفة
        </Button>
      ),
    },
  ];

  const billColumns: ColumnDef<UtilityBill>[] = [
    { key: 'bill', header: 'الفاتورة', render: (bill) => <span className="font-bold">{bill.bill_number || 'فاتورة مرافق بلا مرجع'}</span> },
    { key: 'property', header: 'العقار', render: (bill) => propertyName(bill.property_id) },
    { key: 'amount', header: 'المبلغ', render: (bill) => <strong dir="ltr">{money(bill.amount)}</strong> },
    { key: 'paid', header: 'المسدد', render: (bill) => <strong dir="ltr" className="text-success">{money(bill.paid_amount)}</strong> },
    { key: 'due', header: 'الاستحقاق', render: (bill) => <span dir="ltr">{bill.due_date}</span> },
    { key: 'responsible', header: 'المسؤول', render: (bill) => responsiblePartyLabels[bill.responsible_party] },
    { key: 'status', header: 'الحالة', render: (bill) => <StatusBadge tone={utilityBillStatusTone(bill.status)}>{utilityBillStatusLabels[bill.status]}</StatusBadge> },
    {
      key: 'actions',
      header: 'إجراء',
      render: (bill) => (
        <Button variant="danger" size="sm" aria-label={`أرشفة فاتورة المرافق ${bill.bill_number ?? 'فاتورة مرافق بلا مرجع'}`} onClick={() => setBillToArchive(bill)}>
          <Trash2 className="size-4" />أرشفة
        </Button>
      ),
    },
  ];

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={handlePrint} disabled={!documentSettings.isReady}><Printer className="size-4" />طباعة كشف المرافق</Button>
      <Button variant="secondary" onClick={handleDownloadPdf} disabled={!documentSettings.isReady}><Download className="size-4" />تنزيل PDF</Button>
    </div>
  );

  const body = (
    <>
      {mode === 'embedded' ? <div className="flex flex-wrap justify-end gap-2">{headerActions}</div> : null}
      {!documentSettings.isReady && !documentSettings.isLoading ? <DocumentReadinessNotice /> : null}

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="العدادات المسجلة" value={formatLatinNumber(meters.length, 'ar')} icon={Zap} accent="primary" sub="عدادات مرتبطة بالعقارات" />
        <KpiCard label="إجمالي الفواتير" value={money(totalBilled)} icon={Activity} accent="sky" sub="مطالبات مسجلة" />
        <KpiCard label="المسدد" value={money(totalPaid)} icon={CheckCircle2} accent="emerald" sub="مدفوعات" />
        <KpiCard label="المتبقي" value={money(totalUnpaid)} icon={AlertCircle} accent="rose" sub="مستحق" />
      </ResponsiveCardGrid>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="بحث برقم الفاتورة أو الملاحظات..."
        searchAriaLabel="بحث في فواتير المرافق"
        filters={(
          <>
            <Select aria-label="العقار" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)} className="w-full sm:w-44">
              <option value="all">كل العقارات</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
            </Select>
            <Select aria-label="نوع المرفق" value={utilityFilter} onChange={(event) => setUtilityFilter(event.target.value)} className="w-full sm:w-44">
              <option value="all">كل أنواع المرافق</option>
              {Object.entries(utilityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              <optgroup label="حسب العداد">
                {meters.map((meter) => <option key={meter.id} value={`meter:${meter.id}`}>{utilityTypeLabels[meter.utility_type]} · {meter.meter_number}</option>)}
              </optgroup>
            </Select>
            <Select aria-label="حالة السداد" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as UtilityBillStatus | 'all')} className="w-full sm:w-40">
              <option value="all">كل الحالات</option>
              {Object.entries(utilityBillStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </>
        )}
        actions={(
          <div className="flex w-full gap-2 sm:w-auto">
            <Button onClick={() => setShowMeterForm(true)}><Plus className="size-4" />إضافة عداد</Button>
            <Button variant="secondary" onClick={() => setShowBillForm(true)}><Plus className="size-4" />فاتورة مرافق</Button>
          </div>
        )}
      />
      <ActiveFilterBar filters={activeFilters} onClearAll={clearFilters} />

      <AsyncContentState
        status={isLoading ? 'loading' : isError ? 'error' : meters.length === 0 && filteredBills.length === 0 ? 'empty' : 'ready'}
        error={error}
        errorTitle="تعذر تحميل بيانات المرافق"
        errorAction={<Button onClick={() => { void metersQuery.refetch(); void billsQuery.refetch(); void propertiesQuery.refetch(); }}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد عدادات أو فواتير مرافق"
        emptyDescription="ابدأ بإضافة عداد مرافق وربطه بعقار، ثم سجل فواتير الاستهلاك."
        emptyAction={<Button onClick={() => setShowMeterForm(true)}>إضافة أول عداد</Button>}
      >
        <div className="space-y-5">
          <section className="space-y-3" aria-label="العدادات المسجلة">
            <div><h2 className="text-sm font-black">العدادات المسجلة</h2><p className="text-xs text-muted-foreground">جدول مدمج يحفظ التفاصيل على كل المقاسات.</p></div>
            <EntityTable
              aria-label="جدول عدادات المرافق"
              rows={meters}
              columns={meterColumns}
              keyOf={(meter) => meter.id}
              mobileVisibleSecondaryKey="status"
              emptyTitle="لا توجد عدادات"
              emptyDescription="أضف عدادًا جديدًا لبدء تسجيل الاستهلاك والفواتير."
            />
          </section>

          <section className="space-y-3" aria-label="فواتير المرافق">
            <div><h2 className="text-sm font-black">فواتير المرافق</h2><p className="text-xs text-muted-foreground">الاستهلاك والمبالغ وحالة السداد.</p></div>
            <EntityTable
              aria-label="جدول فواتير المرافق"
              rows={filteredBills}
              columns={billColumns}
              keyOf={(bill) => bill.id}
              mobileVisibleSecondaryKey="amount"
              emptyTitle="لا توجد فواتير مطابقة"
              emptyDescription="غيّر الفلاتر أو أضف فاتورة مرافق جديدة."
            />
          </section>
        </div>
      </AsyncContentState>

      <EntityForm.Overlay open={showMeterForm} onOpenChange={(open) => { if (!createMeterMut.isPending) setShowMeterForm(open); }} title="إضافة عداد مرافق" description="اربط العداد بعقار وحدد بيانات الحساب والمسؤول." visualVariant="operational">
        <EntityForm.Root onSubmit={(event) => { event.preventDefault(); void handleCreateMeter(); }} aria-busy={createMeterMut.isPending}>
          <EntityForm.ErrorSummary message={createMeterMut.isError ? (createMeterMut.error as Error).message : undefined} />
          <EntityForm.Section title="بيانات العداد">
            <EntityForm.Field label="العقار *"><Select required value={meterForm.property_id} onChange={(event) => setMeterForm((form) => ({ ...form, property_id: event.target.value }))}><option value="">اختر العقار</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</Select></EntityForm.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="نوع المرفق *"><Select required value={meterForm.utility_type} onChange={(event) => setMeterForm((form) => ({ ...form, utility_type: event.target.value as UtilityType }))}>{Object.entries(utilityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="المسؤول *"><Select required value={meterForm.responsible_party} onChange={(event) => setMeterForm((form) => ({ ...form, responsible_party: event.target.value as ResponsibleParty }))}>{Object.entries(responsiblePartyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="رقم العداد *"><Input required value={meterForm.meter_number} onChange={(event) => setMeterForm((form) => ({ ...form, meter_number: event.target.value }))} /></EntityForm.Field>
              <EntityForm.Field label="رقم الحساب *"><Input required value={meterForm.account_number} onChange={(event) => setMeterForm((form) => ({ ...form, account_number: event.target.value }))} /></EntityForm.Field>
            </div>
            <EntityForm.Field label="مزود الخدمة"><Input value={meterForm.provider_name || ''} onChange={(event) => setMeterForm((form) => ({ ...form, provider_name: event.target.value }))} /></EntityForm.Field>
            <EntityForm.Field label="ملاحظات"><Textarea value={meterForm.notes || ''} onChange={(event) => setMeterForm((form) => ({ ...form, notes: event.target.value }))} /></EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={createMeterMut.isPending ? 'جارٍ الحفظ...' : 'حفظ العداد'} onCancel={() => setShowMeterForm(false)} isSubmitting={createMeterMut.isPending} submitDisabled={!meterForm.property_id || !meterForm.meter_number.trim() || !meterForm.account_number.trim()} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay open={showBillForm} onOpenChange={(open) => { if (!createBillMut.isPending) setShowBillForm(open); }} title="إضافة فاتورة مرافق" description="سجل القراءة والمبلغ وتاريخ الاستحقاق." visualVariant="operational">
        <EntityForm.Root onSubmit={(event) => { event.preventDefault(); void handleCreateBill(); }} aria-busy={createBillMut.isPending}>
          <EntityForm.ErrorSummary message={createBillMut.isError ? (createBillMut.error as Error).message : undefined} />
          <EntityForm.Section title="بيانات الفاتورة">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="العقار *"><Select required value={billForm.property_id} onChange={(event) => setBillForm((form) => ({ ...form, property_id: event.target.value }))}><option value="">اختر العقار</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="العداد"><Select value={billForm.meter_id || ''} onChange={(event) => setBillForm((form) => ({ ...form, meter_id: event.target.value || null }))}><option value="">بدون عداد محدد</option>{meters.map((meter) => <option key={meter.id} value={meter.id}>{utilityTypeLabels[meter.utility_type]} · {meter.meter_number}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="المبلغ *"><Input required type="number" min={MONEY_MIN_POSITIVE} step={MONEY_STEP} inputMode="decimal" dir="ltr" value={billForm.amount} onChange={(event) => setBillForm((form) => ({ ...form, amount: Number(event.target.value) || 0 }))} /></EntityForm.Field>
              <EntityForm.Field label="تاريخ الاستحقاق *"><Input required type="date" value={billForm.due_date} onChange={(event) => setBillForm((form) => ({ ...form, due_date: event.target.value }))} /></EntityForm.Field>
              <EntityForm.Field label="القراءة السابقة"><Input type="number" inputMode="decimal" value={billForm.previous_reading ?? ''} onChange={(event) => setBillForm((form) => ({ ...form, previous_reading: event.target.value ? Number(event.target.value) : null }))} /></EntityForm.Field>
              <EntityForm.Field label="القراءة الحالية"><Input type="number" inputMode="decimal" value={billForm.current_reading ?? ''} onChange={(event) => setBillForm((form) => ({ ...form, current_reading: event.target.value ? Number(event.target.value) : null }))} /></EntityForm.Field>
              <EntityForm.Field label="الاستهلاك"><Input type="number" inputMode="decimal" value={billForm.consumption_units ?? ''} onChange={(event) => setBillForm((form) => ({ ...form, consumption_units: event.target.value ? Number(event.target.value) : null }))} /></EntityForm.Field>
              <EntityForm.Field label="المسؤول"><Select value={billForm.responsible_party} onChange={(event) => setBillForm((form) => ({ ...form, responsible_party: event.target.value as ResponsibleParty }))}>{Object.entries(responsiblePartyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></EntityForm.Field>
              <EntityForm.Field label="رقم الفاتورة"><Input value={billForm.bill_number || ''} onChange={(event) => setBillForm((form) => ({ ...form, bill_number: event.target.value }))} /></EntityForm.Field>
            </div>
            <EntityForm.Field label="ملاحظات"><Textarea value={billForm.notes || ''} onChange={(event) => setBillForm((form) => ({ ...form, notes: event.target.value }))} /></EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={createBillMut.isPending ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'} onCancel={() => setShowBillForm(false)} isSubmitting={createBillMut.isPending} submitDisabled={!billForm.property_id || billForm.amount <= 0 || !billForm.due_date} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog open={Boolean(meterToArchive)} onOpenChange={(open) => { if (!open && !deleteMeterMut.isPending) setMeterToArchive(null); }} title="أرشفة عداد المرافق؟" description={meterToArchive ? `سيتم أرشفة العداد ${meterToArchive.meter_number} المرتبط بـ ${propertyName(meterToArchive.property_id)} وإخفاؤه من القوائم النشطة.` : undefined} confirmLabel="تأكيد الأرشفة" variant="danger" isLoading={deleteMeterMut.isPending} onConfirm={handleConfirmArchiveMeter} />
      <ConfirmDialog
        open={Boolean(billToArchive)}
        onOpenChange={(open) => { if (!open && !deleteBillMut.isPending) setBillToArchive(null); }}
        title="أرشفة فاتورة المرافق؟"
        description={billToArchive ? `ستُخفى الفاتورة من السجل النشط مع الاحتفاظ بتاريخها وارتباطاتها.` : undefined}
        confirmLabel="تأكيد الأرشفة"
        variant="danger"
        isLoading={deleteBillMut.isPending}
        onConfirm={handleConfirmArchiveBill}
      >
        {billToArchive ? (
          <dl className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">الفاتورة</dt><dd className="font-bold">{billToArchive.bill_number ?? 'فاتورة مرافق بلا مرجع'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">نوع المرفق</dt><dd className="font-bold">{utilityTypeLabels[meters.find((meter) => meter.id === billToArchive.meter_id)?.utility_type ?? 'electricity']}</dd></div>
            <div><dt className="text-xs text-muted-foreground">العقار</dt><dd className="font-bold">{propertyName(billToArchive.property_id)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">المبلغ</dt><dd className="font-bold">{money(billToArchive.amount)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">فترة الفاتورة</dt><dd className="font-bold" dir="ltr">{billToArchive.billing_period_start || '—'} → {billToArchive.billing_period_end || '—'}</dd></div>
          </dl>
        ) : null}
      </ConfirmDialog>
    </>
  );

  if (mode === 'embedded') return <div className="space-y-5">{body}</div>;

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <PageHeader title="إدارة المرافق والعدادات" description="العدادات وفواتير الاستهلاك في جداول مدمجة تحفظ كامل المعلومات على كل المقاسات." primaryAction={headerActions} />
      {body}
    </PageLayout>
  );
}
