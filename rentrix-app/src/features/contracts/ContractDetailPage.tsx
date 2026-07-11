import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Edit, MessageCircle, Printer, RefreshCw, Share2, ShieldAlert, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildContractActions } from '@/components/ui/entity-action-presets';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { openWhatsApp, printCurrentView, shareOrCopy } from '@/services/action-service';
import { exportContractToPdf } from '@/services/pdfService';
import type { Person, Property, Unit } from '@/types/domain';
import { useCompanySettingsContract } from '../settings/useCompanySettings';
import { formatContractDate, formatContractDateTime, formatContractDayCount, formatContractMoney, getContractInclusiveDays, getContractRemainingDays } from './contractDisplayFormatters';
import { Textarea } from '@/components/ui/textarea';
import { contractStatusLabels, contractStatusTone, paymentCycleLabels, renewalSchema, type RenewalPayload } from './contractSchema';
import { ContractDocumentsShell } from './contractDocumentsShell';
import { ContractPaymentsTab } from './contractPaymentsTab';
import type { ContractDetail } from './services/contractService';
import { useContract, useRenewContract, useTerminateContract } from './useContracts';

type TimelineTone = 'blue' | 'green' | 'red' | 'gray' | 'gold';
type TimelineItem = Readonly<{ title: string; value: string; description: string; tone: TimelineTone }>;

const fieldError = (message?: string) => message ? <span className="text-xs font-bold text-destructive">{message}</span> : null;
const getContractDetailErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء تحميل العقد.';
const toDateInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (value: string, days: number) => { const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + days); return date; };
const addYear = (date: Date) => { const nextDate = new Date(date); nextDate.setFullYear(nextDate.getFullYear() + 1); nextDate.setDate(nextDate.getDate() - 1); return nextDate; };
const canRenewContract = (contract: ContractDetail) => contract.status === 'active' || contract.status === 'expired';
const canTerminateContract = (contract: ContractDetail) => contract.status === 'active' || contract.status === 'draft';
const getRenewalDefaults = (contract: ContractDetail): RenewalPayload => { const nextStart = addDays(contract.end_date, 1); return { new_start: toDateInputValue(nextStart), new_end: toDateInputValue(addYear(nextStart)), new_amount: contract.rent_amount }; };

const toPdfTenant = (person: ContractDetail['people']): Person | null => person ? { ...person, type: 'tenant', address: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null } : null;
const toPdfUnit = (unit: ContractDetail['units'], propertyId: string): Unit | null => unit ? { ...unit, name: null, property_id: propertyId, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null } : null;
const toPdfProperty = (property: ContractDetail['properties']): Property | null => property ? { ...property, type: 'residential', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null } : null;

function getExpiryDescription(settings: CompanySettingsContract, contract: ContractDetail): string {
  if (contract.status === 'terminated') return 'تم إنهاء العقد ولا توجد مدة متبقية معروضة.';
  const remainingDays = getContractRemainingDays(contract.end_date);
  if (remainingDays < 0) return `انتهى منذ ${formatContractDayCount(settings, Math.abs(remainingDays))} يوم.`;
  return remainingDays === 0 ? 'ينتهي اليوم حسب تاريخ نهاية العقد.' : `باقي ${formatContractDayCount(settings, remainingDays)} يوم حتى تاريخ النهاية.`;
}

function getTimeline(settings: CompanySettingsContract, contract: ContractDetail): TimelineItem[] {
  const expiryDays = getContractRemainingDays(contract.end_date);
  return [
    { title: 'إنشاء العقد', value: formatContractDateTime(settings, contract.created_at), description: 'وقت تسجيل العقد في النظام.', tone: 'blue' },
    { title: 'تاريخ البداية', value: formatContractDate(settings, contract.start_date), description: `بداية الالتزام التجاري لمدة ${formatContractDayCount(settings, getContractInclusiveDays(contract.start_date, contract.end_date))} يوم.`, tone: 'green' },
    { title: 'تاريخ النهاية', value: formatContractDate(settings, contract.end_date), description: getExpiryDescription(settings, contract), tone: contract.status === 'terminated' ? 'red' : expiryDays < 0 ? 'gray' : expiryDays <= 30 ? 'gold' : 'green' },
    { title: 'آخر تحديث', value: formatContractDateTime(settings, contract.updated_at), description: 'آخر تعديل محفوظ على بيانات العقد.', tone: 'gray' },
  ];
}

export function ContractDetailPage() {
  const { contractId } = useParams({ strict: false }) as { contractId: string };
  const navigate = useNavigate();
  const contractQuery = useContract(contractId);
  const companySettings = useCompanySettingsContract();
  const renewMutation = useRenewContract(contractId);
  const terminateMutation = useTerminateContract(contractId);
  const [open, setOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const form = useForm<RenewalPayload>({ resolver: zodResolver(renewalSchema), defaultValues: { new_start: '', new_end: '', new_amount: 0 } });

  if (contractQuery.isLoading || contractQuery.isError || !contractQuery.data) {
    return (
      <AsyncContentState
        status={contractQuery.isLoading ? 'loading' : contractQuery.isError ? 'error' : 'empty'}
        error={contractQuery.error}
        errorTitle="تعذر تحميل العقد"
        errorFallbackMessage={getContractDetailErrorMessage(contractQuery.error)}
        errorAction={<Button onClick={() => void contractQuery.refetch()}>إعادة المحاولة</Button>}
        emptyTitle="العقد غير موجود"
        emptyDescription="ربما تم حذف العقد أو لا تملك صلاحية الوصول إليه."
      >
        {null}
      </AsyncContentState>
    );
  }

  const contract = contractQuery.data;
  const renewalAllowed = canRenewContract(contract);
  const timeline = getTimeline(companySettings, contract);

  const exportContractPdf = () => {
    const tenant = toPdfTenant(contract.people);
    const unit = toPdfUnit(contract.units, contract.property_id);
    const property = toPdfProperty(contract.properties);
    exportContractToPdf(contract, {
      settings: { general: { company: { name: companySettings.companyName } }, operational: { currency: companySettings.defaultCurrency } },
      contracts: [contract], tenants: tenant ? [tenant] : [], units: unit ? [unit] : [], properties: property ? [property] : [],
    });
  };

  const printContract = () => printCurrentView();

  const shareContract = async () => {
    const title = `عقد #${contract.id.slice(0, 8)}`;
    try {
      const result = await shareOrCopy({ title, url: window.location.href });
      if (result === 'copied') toast.success('تم نسخ رابط العقد');
      if (result === 'unavailable') toast.error('تعذر مشاركة رابط العقد من هذا المتصفح');
    } catch {
      toast.error('تعذر مشاركة رابط العقد');
    }
  };

  const openContractWhatsApp = () => {
    const message = `مرحباً${contract.people?.full_name ? ` ${contract.people.full_name}` : ''}، بخصوص عقد #${contract.id.slice(0, 8)} على ${contract.properties?.title ?? 'العقار'} / ${contract.units?.unit_number ?? 'الوحدة'}.`;
    openWhatsApp(contract.people?.phone, message);
  };

  const contractMenuActions = buildContractActions({
    onPrint: printContract,
    onPdf: exportContractPdf,
    onWhatsApp: openContractWhatsApp,
    onShare: () => {
      void shareContract();
    },
    onRenew: renewalAllowed
      ? () => {
          form.reset(getRenewalDefaults(contract));
          setOpen(true);
        }
      : undefined,
    onTerminate: canTerminateContract(contract)
      ? () => {
          setTerminateReason('');
          setTerminateOpen(true);
        }
      : undefined,
  });

  const submitRenewal = async (values: RenewalPayload) => {
    const result = await renewMutation.mutateAsync(values);
    setOpen(false);
    await navigate({ to: '/contracts/$contractId', params: { contractId: result.new_contract_id } });
  };

  const submitTermination = async () => {
    await terminateMutation.mutateAsync(terminateReason);
    setTerminateOpen(false);
    setTerminateReason('');
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <EntityDetailHeader
        title="تفاصيل العقد"
        subtitle={`العقد رقم #${contract.id.slice(0, 8)} — عرض كامل للعقد وسجل مراحله.`}
        backTo="/contracts"
        actions={
          <>
            <Button variant="secondary" className="hidden sm:inline-flex" disabled={!renewalAllowed} onClick={() => { form.reset(getRenewalDefaults(contract)); setOpen(true); }}><RefreshCw className="me-2 size-4" />تجديد</Button>
            {canTerminateContract(contract) && (
              <Button variant="destructive" className="hidden sm:inline-flex" onClick={() => { setTerminateReason(''); setTerminateOpen(true); }}><ShieldAlert className="me-2 size-4" />إنهاء العقد</Button>
            )}
            <Button variant="secondary" className="hidden md:inline-flex" onClick={printContract}><Printer className="me-2 size-4" />طباعة</Button>
            <Button variant="secondary" className="hidden md:inline-flex" onClick={exportContractPdf}>تصدير PDF</Button>
            <Button variant="secondary" className="hidden lg:inline-flex" onClick={openContractWhatsApp}><MessageCircle className="me-2 size-4" />واتساب</Button>
            <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => { void shareContract(); }}><Share2 className="me-2 size-4" />مشاركة</Button>
            <ActionMenu items={contractMenuActions} label="إجراءات العقد" />
            <Button asChild><Link to="/contracts/$contractId/edit" params={{ contractId }}><Edit className="me-2 size-4" />تعديل</Link></Button>
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>بيانات العقد</CardTitle><CardDescription>الحقول الأساسية وربط العقار والوحدة والمستأجر.</CardDescription></CardHeader>
        <CardContent>
          <DetailFields
            fields={[
              { label: 'العقد رقم', value: `#${contract.id.slice(0, 8)}` },
              { label: 'المستأجر', value: contract.people?.full_name },
              { label: 'الوحدة', value: contract.units?.unit_number },
              { label: 'العقار', value: contract.properties?.title },
              { label: 'تاريخ البداية', value: formatContractDate(companySettings, contract.start_date) },
              { label: 'تاريخ النهاية', value: formatContractDate(companySettings, contract.end_date) },
              { label: 'قيمة الإيجار', value: formatContractMoney(companySettings, contract.rent_amount) },
              { label: 'دورة السداد', value: paymentCycleLabels[contract.payment_cycle] },
              { label: 'الحالة', value: <StatusBadge tone={contractStatusTone[contract.status]}>{contractStatusLabels[contract.status]}</StatusBadge> },
              { label: 'سبب الإلغاء', value: contract.status === 'terminated' ? contract.cancellation_reason?.trim() || '—' : 'غير مطبق' },
              { label: 'ملاحظات', value: contract.notes, wide: true },
            ]}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/20 bg-primary/5"><CardHeader className="bg-background/80"><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-primary" />إجراءات التجديد والإنهاء</CardTitle><CardDescription>{getExpiryDescription(companySettings, contract)}</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><p className="text-sm text-muted-foreground">{contract.renewed_from ? 'هذا العقد مجدد من عقد سابق.' : 'لا يوجد عقد سابق مرتبط بهذا العقد.'}</p>{canTerminateContract(contract) ? <Button variant="destructive" onClick={() => { setTerminateReason(''); setTerminateOpen(true); }}>إنهاء العقد بسبب</Button> : <Button variant="secondary" asChild><Link to="/contracts/$contractId/edit" params={{ contractId: contract.id }}>تعديل الحالة وسبب الإلغاء</Link></Button>}</CardContent></Card>

      <ContractPaymentsTab contractId={contract.id} />

      <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5 text-primary" />الخط الزمني المالي</CardTitle><CardDescription>ملخص من بيانات العقد الحالية.</CardDescription></CardHeader><CardContent className="pt-6"><DetailFields columns={3} fields={[{ label: 'قيمة الإيجار', value: formatContractMoney(companySettings, contract.rent_amount) }, { label: 'الوحدة المؤجرة', value: contract.units?.unit_number }, { label: 'العقار', value: contract.properties?.title }]} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" />الخط الزمني</CardTitle></CardHeader><CardContent className="space-y-3">{timeline.map((item) => <TimelineRow item={item} key={item.title} />)}</CardContent></Card>

      <ContractDocumentsShell contractId={contract.id} />

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>تجديد العقد</DialogTitle><DialogDescription>سيتم إنشاء عقد جديد مرتبط بالعقد الحالي مع حفظ سلسلة التجديد.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={form.handleSubmit(submitRenewal)}><label className="grid gap-2 text-sm font-bold">تاريخ البداية<Input type="date" {...form.register('new_start')} />{fieldError(form.formState.errors.new_start?.message)}</label><label className="grid gap-2 text-sm font-bold">تاريخ النهاية<Input type="date" {...form.register('new_end')} />{fieldError(form.formState.errors.new_end?.message)}</label><label className="grid gap-2 text-sm font-bold">قيمة الإيجار<Input type="number" step="0.01" min="0" {...form.register('new_amount')} />{fieldError(form.formState.errors.new_amount?.message)}</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button><Button type="submit" disabled={renewMutation.isPending}>تجديد العقد</Button></div></form></DialogContent></Dialog>

      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنهاء العقد</DialogTitle>
            <DialogDescription>سيتم تعيين حالة العقد إلى "منتهٍ" وإلغاء أي فواتير مستقبلية غير مدفوعة مرتبطة به. هذا الإجراء لا يمكن التراجع عنه من هنا.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitTermination();
            }}
          >
            <label className="grid gap-2 text-sm font-bold">
              سبب الإنهاء (إلزامي)
              <Textarea
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                placeholder="اذكر سبب إنهاء العقد..."
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setTerminateOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="destructive" disabled={terminateMutation.isPending || terminateReason.trim() === ''}>
                تأكيد الإنهاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

function TimelineRow({ item }: Readonly<{ item: TimelineItem }>) { return <div className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4"><span className="mt-1 size-3 rounded-full bg-primary" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{item.title}</p><StatusBadge tone={item.tone}>{item.value}</StatusBadge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div></div>; }