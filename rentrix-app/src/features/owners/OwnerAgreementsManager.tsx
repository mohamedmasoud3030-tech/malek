import { useMemo, useState, type FormEvent } from 'react';
import { addDays, format } from 'date-fns';
import { Link } from '@tanstack/react-router';
import { History, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EntityForm } from '@/components/ui/entity-form';
import { MobileFormStepperFooter, MobileFormStepperHeader } from '@/components/ui/mobile-form-stepper';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getActionableSupabaseErrorMessage } from '@/lib/supabase-error';
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import { listOwners, listPropertyOwners, type Owner } from './services/owner-service';
import {
  assertAgreementOwnerHasOwnership,
  getEligibleAgreementOwners,
  groupAgreementsByTemporalStatus,
  type OwnerAgreement,
  type OwnerAgreementFormPayload,
  type OwnerAgreementVersion,
  type OwnerAgreementVersionTerms,
} from './ownerAgreementService';
import { useCreateOwnerAgreement, useCreateOwnerAgreementVersion, useOwnerAgreements, useOwnerAgreementVersions } from './useOwnerAgreements';
import { useQuery } from '@tanstack/react-query';
import { MONEY_STEP } from '@/lib/money';

type AgreementFormState = {
  owner_id: string;
  agreement_type: 'property_management';
  collection_role: 'OWNER_IS_CREDITOR' | 'OFFICE_IS_CREDITOR';
  commission_type: 'RATE' | 'FIXED_MONTHLY';
  commission_value: string;
  starts_on: string;
  ends_on: string;
  notes: string;
};

type VersionFormState = {
  collection_role: 'OWNER_IS_CREDITOR' | 'OFFICE_IS_CREDITOR';
  commission_type: 'RATE' | 'FIXED_MONTHLY';
  commission_value: string;
  effective_from: string;
  effective_to: string;
  offset_allowed: boolean;
  reserve_amount: string;
  deposit_beneficiary: '' | 'OWNER' | 'OFFICE';
  deposit_custodian: '' | 'OWNER' | 'OFFICE';
  notes: string;
};

const emptyForm: AgreementFormState = { owner_id: '', agreement_type: 'property_management', collection_role: 'OWNER_IS_CREDITOR', commission_type: 'RATE', commission_value: '10', starts_on: '', ends_on: '', notes: '' };
const agreementTypeLabels = { property_management: 'إدارة عقار' } as const;
const commissionTypeLabels = { RATE: 'نسبة', FIXED_MONTHLY: 'مبلغ شهري ثابت' } as const;
const earliestAmendmentDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');

const agreementFormSteps = [
  { id: 'owner-period', label: 'المالك والفترة' },
  { id: 'commercial', label: 'التحصيل والعمولة' },
  { id: 'review', label: 'التأكيد' },
] as const;

function toPayload(propertyId: string, values: AgreementFormState): OwnerAgreementFormPayload {
  return { property_id: propertyId, owner_id: values.owner_id, agreement_type: values.agreement_type, collection_role: values.collection_role, commission_type: values.commission_type, commission_value: Number(values.commission_value), starts_on: values.starts_on, ends_on: values.ends_on || null, notes: values.notes || null };
}

function getOwnerName(owners: readonly Owner[], ownerId: string) {
  const owner = owners.find((item) => item.id === ownerId);
  return owner?.display_name || owner?.full_name || 'مالك غير معروف';
}

function AgreementRow({ agreement, versions, owners, onAmend, tone }: { agreement: OwnerAgreement; versions: readonly OwnerAgreementVersion[]; owners: readonly Owner[]; onAmend: (agreement: OwnerAgreement, current: OwnerAgreementVersion | null) => void; tone: 'success' | 'info' | 'neutral' }) {
  const current = versions.find((version) => version.superseded_at === null) ?? null;
  const displayedCommissionType = current?.commission_type ?? agreement.commission_type;
  const displayedCommissionValue = current?.commission_value ?? agreement.commission_value;
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>{agreement.ends_on ? 'محددة المدة' : 'مفتوحة'}</StatusBadge>
            <span className="font-semibold">{getOwnerName(owners, agreement.owner_id)}</span>
            <span className="text-sm text-muted-foreground">{agreementTypeLabels.property_management}</span>
          </div>
          <p className="text-sm text-muted-foreground">الفترة: {formatDate(agreement.starts_on)} — {agreement.ends_on ? formatDate(agreement.ends_on) : 'مفتوحة'}</p>
          <p className="text-sm text-muted-foreground">التحصيل: {current?.collection_role === 'OFFICE_IS_CREDITOR' ? 'المكتب هو الدائن' : 'المالك هو الدائن'}</p>
          <p className="text-sm text-muted-foreground">العمولة: {commissionTypeLabels[displayedCommissionType]} · {displayedCommissionType === 'RATE' ? `${formatNumber(displayedCommissionValue)}%` : formatMoney(displayedCommissionValue)}</p>
          {agreement.notes ? <p className="text-sm leading-7">{agreement.notes}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => onAmend(agreement, current)}><Plus className="me-2 size-4" />تعديل الشروط</Button>
      </div>
      <details className="mt-3 border-t pt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-muted-foreground"><History className="me-2 inline size-4" />سجل التعديلات ({versions.length})</summary>
        <div className="mt-3 space-y-2">
          {versions.length ? versions.map((version) => (
            <div key={version.id} className="rounded-xl bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{version.superseded_at ? 'شروط سابقة' : 'الشروط الحالية'}</strong>
                <StatusBadge tone={version.superseded_at ? 'neutral' : 'success'}>{version.superseded_at ? 'سابقة' : 'سارية'}</StatusBadge>
              </div>
              <p className="mt-1 text-muted-foreground">من {formatDate(version.effective_from)} — {version.effective_to ? formatDate(version.effective_to) : 'مفتوح'} · {version.collection_role === 'OFFICE_IS_CREDITOR' ? 'المكتب هو الدائن' : 'المالك هو الدائن'}</p>
            </div>
          )) : <p className="text-muted-foreground">لا يوجد سجل تعديلات بعد.</p>}
        </div>
      </details>
    </div>
  );
}

export function OwnerAgreementsManager({ propertyId }: { propertyId: string }) {
  const agreementsQuery = useOwnerAgreements(propertyId);
  const ownershipQuery = useQuery({
    queryKey: ['property_owners', propertyId, 'agreement-options'],
    queryFn: () => listPropertyOwners(propertyId),
    enabled: Boolean(propertyId),
  });
  const ownersQuery = useQuery({ queryKey: ['owners', 'agreement-display'], queryFn: listOwners });
  const agreementIds = (agreementsQuery.data ?? []).map((agreement) => agreement.id);
  const versionsQuery = useOwnerAgreementVersions(agreementIds);
  const createMutation = useCreateOwnerAgreement(propertyId);
  const versionMutation = useCreateOwnerAgreementVersion(propertyId);
  const [form, setForm] = useState<AgreementFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [agreementStep, setAgreementStep] = useState(0);
  const [amendingAgreement, setAmendingAgreement] = useState<OwnerAgreement | null>(null);
  const [versionForm, setVersionForm] = useState<VersionFormState | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  const grouped = useMemo(() => groupAgreementsByTemporalStatus(agreementsQuery.data ?? []), [agreementsQuery.data]);
  const ownershipLinks = ownershipQuery.data ?? [];
  const propertyOwners = useMemo(() => {
    const ownersById = new Map<string, Owner>();
    for (const link of ownershipLinks) if (link.owner?.is_active) ownersById.set(link.owner_id, link.owner);
    return [...ownersById.values()];
  }, [ownershipLinks]);
  const owners = ownersQuery.data ?? propertyOwners;
  const eligibleOwners = useMemo(() => form.starts_on ? getEligibleAgreementOwners(ownershipLinks, form.starts_on, form.ends_on || null) : propertyOwners, [form.ends_on, form.starts_on, ownershipLinks, propertyOwners]);

  const goNextAgreementStep = () => {
    if (agreementStep === 0) {
      if (!form.owner_id) { setFormError('اختر المالك الذي تغطي ملكيته الفترة.'); return; }
      if (!form.starts_on) { setFormError('تاريخ بداية الاتفاقية مطلوب.'); return; }
      if (form.ends_on && form.ends_on < form.starts_on) { setFormError('تاريخ نهاية الاتفاقية يجب ألا يسبق البداية.'); return; }
      const eligibleForPeriod = getEligibleAgreementOwners(ownershipLinks, form.starts_on, form.ends_on || null);
      if (!eligibleForPeriod.some((owner) => owner.id === form.owner_id)) {
        setFormError('المالك المحدد لا تغطي ملكيته الفترة المختارة كاملة — اختر مالكاً آخر أو عدّل التواريخ.');
        return;
      }
    }
    if (agreementStep === 1) {
      const commissionValue = Number(form.commission_value);
      if (!form.commission_value.trim() || !Number.isFinite(commissionValue) || commissionValue <= 0) { setFormError('قيمة العمولة يجب أن تكون رقماً موجباً.'); return; }
    }
    setFormError(null);
    setAgreementStep((current) => Math.min(current + 1, agreementFormSteps.length - 1));
  };

  const stepVisibility = (stepIndex: number) => (agreementStep === stepIndex ? '' : 'max-md:hidden');
  const startCreate = () => {
    setForm({ ...emptyForm, owner_id: propertyOwners.length === 1 ? propertyOwners[0].id : '' });
    setFormError(null); setAgreementStep(0); setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setForm(emptyForm); setFormError(null); setAgreementStep(0); };
  const startAmendment = (agreement: OwnerAgreement, current: OwnerAgreementVersion | null) => {
    setAmendingAgreement(agreement); setVersionError(null);
    setVersionForm({ collection_role: current?.collection_role ?? 'OWNER_IS_CREDITOR', commission_type: current?.commission_type ?? agreement.commission_type, commission_value: String(current?.commission_value ?? agreement.commission_value), effective_from: earliestAmendmentDate, effective_to: agreement.ends_on ?? '', offset_allowed: current?.offset_allowed ?? false, reserve_amount: String(current?.reserve_amount ?? 0), deposit_beneficiary: current?.deposit_beneficiary ?? '', deposit_custodian: current?.deposit_custodian ?? '', notes: current?.notes ?? agreement.notes ?? '' });
  };
  const closeAmendment = () => { setAmendingAgreement(null); setVersionForm(null); setVersionError(null); };

  async function submitVersion(event: FormEvent) {
    event.preventDefault();
    if (!amendingAgreement || !versionForm) return;
    setVersionError(null);
    try {
      const terms: OwnerAgreementVersionTerms = { collection_role: versionForm.collection_role, commission_type: versionForm.commission_type, commission_value: Number(versionForm.commission_value), effective_from: versionForm.effective_from, effective_to: versionForm.effective_to || null, offset_allowed: versionForm.offset_allowed, reserve_amount: Number(versionForm.reserve_amount || 0), deposit_beneficiary: versionForm.deposit_beneficiary || null, deposit_custodian: versionForm.deposit_custodian || null, notes: versionForm.notes || null };
      await versionMutation.mutateAsync({ agreementId: amendingAgreement.id, terms });
      toast.success('تم حفظ تعديل الشروط مع الاحتفاظ بالسجل السابق.');
      closeAmendment();
    } catch (error) {
      setVersionError(getActionableSupabaseErrorMessage(error, 'تعذر حفظ تعديل الاتفاقية.'));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setFormError(null);
    try {
      const payload = toPayload(propertyId, form);
      assertAgreementOwnerHasOwnership(ownershipLinks, payload);
      await createMutation.mutateAsync(payload);
      toast.success('تم إنشاء اتفاقية إدارة المالك.');
      closeForm();
    } catch (error) {
      setFormError(getActionableSupabaseErrorMessage(error, 'تعذر حفظ اتفاقية المالك.'));
    }
  }

  const saving = createMutation.isPending;
  const loading = agreementsQuery.isLoading || ownershipQuery.isLoading || versionsQuery.isLoading;
  const versionsByAgreement = new Map<string, OwnerAgreementVersion[]>();
  for (const version of versionsQuery.data ?? []) {
    const existing = versionsByAgreement.get(version.owner_agreement_id) ?? [];
    existing.push(version); versionsByAgreement.set(version.owner_agreement_id, existing);
  }
  const hasOwnershipLinks = ownershipLinks.length > 0;
  const hasOperationalOwner = propertyOwners.length > 0;
  const hasCurrentAgreement = grouped.current.length > 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle>اتفاقيات إدارة المالك</CardTitle><CardDescription>من يدير التحصيل وكم عمولة المكتب وفترة سريان الاتفاقية.</CardDescription></div>
          <Button variant="secondary" onClick={startCreate} disabled={loading || !hasOperationalOwner}><Plus className="me-2 size-4" /> إضافة اتفاقية</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <p className="text-sm text-muted-foreground">جارٍ تحميل بيانات الاتفاقية والملكية...</p> : null}
        {agreementsQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل اتفاقيات المالك لهذا العقار.</p> : null}
        {ownershipQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل ملاك العقار وفترات ملكيتهم.</p> : null}
        {!loading && !ownershipQuery.isError && !hasOwnershipLinks ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3"><div><p className="text-sm font-bold text-warning">لا توجد ملكية سارية لهذا العقار.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">اربط مالكاً بالعقار وحدد فترة الملكية أولاً.</p></div><Button type="button" variant="secondary" className="min-h-11" asChild><Link to="/owners">إدارة الملكية</Link></Button></div> : null}
        {!loading && hasOwnershipLinks && !hasOperationalOwner ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3" role="alert"><div><p className="text-sm font-bold text-warning">المالك المرتبط غير نشط.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">فعّل المالك أو اربط مالكاً نشطاً قبل إنشاء الاتفاقية.</p></div><Button type="button" variant="secondary" className="min-h-11" asChild><Link to="/owners">مراجعة المالك</Link></Button></div> : null}
        {!loading && hasOperationalOwner && !hasCurrentAgreement ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3" role="status"><div><p className="text-sm font-bold text-warning">لا توجد اتفاقية سارية تغطي عقد الإيجار.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">أنشئ اتفاقية إدارة قبل إضافة العقد.</p></div><Button type="button" variant="secondary" onClick={startCreate}>إنشاء الاتفاقية الآن</Button></div> : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3"><h3 className="text-sm font-bold">السارية</h3>{grouped.current.length ? grouped.current.map((agreement) => <AgreementRow key={agreement.id} agreement={agreement} versions={versionsByAgreement.get(agreement.id) ?? []} owners={owners} tone="success" onAmend={startAmendment} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقية سارية اليوم.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-bold">المجدولة</h3>{grouped.scheduled.length ? grouped.scheduled.map((agreement) => <AgreementRow key={agreement.id} agreement={agreement} versions={versionsByAgreement.get(agreement.id) ?? []} owners={owners} tone="info" onAmend={startAmendment} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات مستقبلية.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-bold">المنتهية</h3>{grouped.ended.length ? grouped.ended.map((agreement) => <AgreementRow key={agreement.id} agreement={agreement} versions={versionsByAgreement.get(agreement.id) ?? []} owners={owners} tone="neutral" onAmend={startAmendment} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات منتهية.</p>}</section>
        </div>
      </CardContent>

      <EntityForm.Overlay open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); else setFormOpen(true); }} title="اتفاقية إدارة المالك" description="حدد المالك والفترة، ثم جهة التحصيل وعمولة المكتب." className="max-w-2xl">
        <EntityForm.Root className="md:grid-cols-2" onSubmit={submit}>
          <EntityForm.ErrorSummary message={formError} className="md:col-span-2" />
          <div className="md:col-span-2"><MobileFormStepperHeader steps={agreementFormSteps} current={agreementStep} /></div>
          <EntityForm.Field label="المالك" className={cn('md:col-span-2', stepVisibility(0))}>
            <Select value={form.owner_id} onChange={(event) => setForm((value) => ({ ...value, owner_id: event.target.value }))} required><option value="">اختر المالك</option>{eligibleOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name || owner.full_name}</option>)}</Select>
            {form.starts_on && eligibleOwners.length === 0 ? <p role="alert" className="mt-2 text-sm text-destructive">لا يوجد مالك تغطي ملكيته الفترة المختارة كاملة.</p> : null}
          </EntityForm.Field>
          <EntityForm.Field label="تاريخ البداية" className={stepVisibility(0)}><Input type="date" value={form.starts_on} onChange={(event) => setForm((value) => ({ ...value, starts_on: event.target.value }))} required /></EntityForm.Field>
          <EntityForm.Field label="تاريخ النهاية" className={stepVisibility(0)}><Input type="date" value={form.ends_on} onChange={(event) => setForm((value) => ({ ...value, ends_on: event.target.value }))} /></EntityForm.Field>

          <EntityForm.Field label="من يطالب المستأجر بالإيجار؟" className={stepVisibility(1)}><Select value={form.collection_role} onChange={(event) => setForm((value) => ({ ...value, collection_role: event.target.value as AgreementFormState['collection_role'] }))}><option value="OWNER_IS_CREDITOR">المالك هو الدائن</option><option value="OFFICE_IS_CREDITOR">المكتب هو الدائن</option></Select></EntityForm.Field>
          <EntityForm.Field label="طريقة عمولة المكتب" className={stepVisibility(1)}><Select value={form.commission_type} onChange={(event) => setForm((value) => ({ ...value, commission_type: event.target.value as AgreementFormState['commission_type'] }))}><option value="RATE">نسبة</option><option value="FIXED_MONTHLY">مبلغ شهري ثابت</option></Select></EntityForm.Field>
          <EntityForm.Field label={form.commission_type === 'RATE' ? 'نسبة العمولة' : 'العمولة الشهرية'} className={cn('md:col-span-2', stepVisibility(1))}><Input type="number" step={MONEY_STEP} min="0" max={form.commission_type === 'RATE' ? 100 : undefined} value={form.commission_value} onChange={(event) => setForm((value) => ({ ...value, commission_value: event.target.value }))} required /></EntityForm.Field>

          <div className={cn('rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-3 md:col-span-2', stepVisibility(2))}>
            <p className="font-bold">راجع الاتفاقية</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">المالك</dt><dd className="font-semibold">{getOwnerName(owners, form.owner_id)}</dd></div><div><dt className="text-xs text-muted-foreground">الفترة</dt><dd className="font-semibold">{form.starts_on ? formatDate(form.starts_on) : '—'} — {form.ends_on ? formatDate(form.ends_on) : 'مفتوحة'}</dd></div><div><dt className="text-xs text-muted-foreground">التحصيل</dt><dd className="font-semibold">{form.collection_role === 'OFFICE_IS_CREDITOR' ? 'المكتب هو الدائن' : 'المالك هو الدائن'}</dd></div><div><dt className="text-xs text-muted-foreground">عمولة المكتب</dt><dd className="font-semibold">{commissionTypeLabels[form.commission_type]} · {form.commission_type === 'RATE' ? `${formatNumber(Number(form.commission_value) || 0)}%` : formatMoney(Number(form.commission_value) || 0)}</dd></div></dl>
            <details className="border-t border-primary/10 pt-2"><summary className="min-h-11 cursor-pointer list-none py-2 font-semibold">إضافة ملاحظة اختيارية</summary><EntityForm.Field label="ملاحظات"><Textarea value={form.notes} onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} /></EntityForm.Field></details>
          </div>

          <MobileFormStepperFooter current={agreementStep} steps={agreementFormSteps} onBack={() => { setFormError(null); setAgreementStep((current) => Math.max(0, current - 1)); }} onNext={goNextAgreementStep} onCancel={closeForm} isSubmitting={saving} submitLabel={saving ? 'جار الحفظ...' : 'حفظ الاتفاقية'} />
          <EntityForm.Actions className="max-md:hidden md:col-span-2" onCancel={closeForm} isSubmitting={saving} submitLabel={saving ? 'جار الحفظ...' : 'حفظ الاتفاقية'} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay open={Boolean(amendingAgreement && versionForm)} onOpenChange={(open) => { if (!open) closeAmendment(); }} title="تعديل شروط الاتفاقية" description="حدد متى تبدأ الشروط الجديدة. تبقى الفترات السابقة محفوظة كما هي." className="max-w-2xl">
        {versionForm ? <EntityForm.Root className="md:grid-cols-2" onSubmit={submitVersion}>
          <EntityForm.ErrorSummary message={versionError} className="md:col-span-2" />
          <EntityForm.Field label="يبدأ التعديل من"><Input type="date" min={earliestAmendmentDate} value={versionForm.effective_from} onChange={(event) => setVersionForm((value) => value ? ({ ...value, effective_from: event.target.value }) : value)} required /></EntityForm.Field>
          <EntityForm.Field label="ينتهي في"><Input type="date" value={versionForm.effective_to} onChange={(event) => setVersionForm((value) => value ? ({ ...value, effective_to: event.target.value }) : value)} /></EntityForm.Field>
          <EntityForm.Field label="جهة التحصيل"><Select value={versionForm.collection_role} onChange={(event) => setVersionForm((value) => value ? ({ ...value, collection_role: event.target.value as VersionFormState['collection_role'] }) : value)}><option value="OWNER_IS_CREDITOR">المالك هو الدائن</option><option value="OFFICE_IS_CREDITOR">المكتب هو الدائن</option></Select></EntityForm.Field>
          <EntityForm.Field label="طريقة العمولة"><Select value={versionForm.commission_type} onChange={(event) => setVersionForm((value) => value ? ({ ...value, commission_type: event.target.value as VersionFormState['commission_type'] }) : value)}><option value="RATE">نسبة من التحصيل</option><option value="FIXED_MONTHLY">مبلغ شهري ثابت</option></Select></EntityForm.Field>
          <EntityForm.Field label="قيمة العمولة" className="md:col-span-2"><Input type="number" step={MONEY_STEP} min="0" max={versionForm.commission_type === 'RATE' ? 100 : undefined} value={versionForm.commission_value} onChange={(event) => setVersionForm((value) => value ? ({ ...value, commission_value: event.target.value }) : value)} required /></EntityForm.Field>
          <details className="rounded-xl border border-border/70 bg-muted/10 md:col-span-2"><summary className="min-h-11 cursor-pointer list-none px-4 py-3 text-sm font-semibold">خيارات التسوية والتأمين</summary><div className="grid gap-4 border-t border-border/60 p-4 md:grid-cols-2">
            <EntityForm.Field label="مبلغ الاحتياطي"><Input type="number" step={MONEY_STEP} min="0" value={versionForm.reserve_amount} onChange={(event) => setVersionForm((value) => value ? ({ ...value, reserve_amount: event.target.value }) : value)} /></EntityForm.Field>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" checked={versionForm.offset_allowed} onChange={(event) => setVersionForm((value) => value ? ({ ...value, offset_allowed: event.target.checked }) : value)} />السماح بخصم مستحقات المالك من تسوياته المعتمدة</label>
            <EntityForm.Field label="لمن يعود مبلغ التأمين؟"><Select value={versionForm.deposit_beneficiary} onChange={(event) => setVersionForm((value) => value ? ({ ...value, deposit_beneficiary: event.target.value as VersionFormState['deposit_beneficiary'] }) : value)}><option value="">غير محدد</option><option value="OWNER">المالك</option><option value="OFFICE">المكتب</option></Select></EntityForm.Field>
            <EntityForm.Field label="من يحتفظ بمبلغ التأمين؟"><Select value={versionForm.deposit_custodian} onChange={(event) => setVersionForm((value) => value ? ({ ...value, deposit_custodian: event.target.value as VersionFormState['deposit_custodian'] }) : value)}><option value="">غير محدد</option><option value="OWNER">المالك</option><option value="OFFICE">المكتب</option></Select></EntityForm.Field>
          </div></details>
          <EntityForm.Field label="ملاحظات التعديل" className="md:col-span-2"><Textarea value={versionForm.notes} onChange={(event) => setVersionForm((value) => value ? ({ ...value, notes: event.target.value }) : value)} /></EntityForm.Field>
          <EntityForm.Actions className="md:col-span-2" onCancel={closeAmendment} isSubmitting={versionMutation.isPending} submitLabel={versionMutation.isPending ? 'جار الحفظ...' : 'حفظ التعديل'} />
        </EntityForm.Root> : null}
      </EntityForm.Overlay>
    </Card>
  );
}
