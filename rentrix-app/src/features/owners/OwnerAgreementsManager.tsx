import { useMemo, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
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
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import { listOwners, listPropertyOwners, type Owner } from './services/owner-service';
import {
  assertAgreementOwnerHasOwnership,
  getEligibleAgreementOwners,
  groupAgreementsByTemporalStatus,
  type OwnerAgreement,
  type OwnerAgreementFormPayload,
} from './ownerAgreementService';
import { useCreateOwnerAgreement, useOwnerAgreements, useUpdateOwnerAgreement } from './useOwnerAgreements';
import { useQuery } from '@tanstack/react-query';
import { MONEY_STEP } from '@/lib/money';

type AgreementFormState = {
  owner_id: string;
  agreement_type: 'property_management' | 'master_lease';
  commission_type: 'RATE' | 'FIXED_MONTHLY';
  commission_value: string;
  starts_on: string;
  ends_on: string;
  notes: string;
};

const emptyForm: AgreementFormState = { owner_id: '', agreement_type: 'property_management', commission_type: 'RATE', commission_value: '10', starts_on: '', ends_on: '', notes: '' };
const agreementTypeLabels = { property_management: 'إدارة عقار', master_lease: 'استئجار رئيسي' } as const;
const commissionTypeLabels = { RATE: 'نسبة', FIXED_MONTHLY: 'مبلغ شهري ثابت' } as const;

/** Mobile stepper steps for the owner agreement overlay (actual domain fields only). */
const agreementFormSteps = [
  { id: 'owner', label: 'المالك والسياق' },
  { id: 'scope', label: 'النطاق والشروط المالية' },
  { id: 'period', label: 'المدة والملاحظات' },
  { id: 'review', label: 'المراجعة والتأكيد' },
] as const;

function agreementToForm(agreement: OwnerAgreement): AgreementFormState {
  return { owner_id: agreement.owner_id, agreement_type: agreement.agreement_type, commission_type: agreement.commission_type, commission_value: String(agreement.commission_value), starts_on: agreement.starts_on, ends_on: agreement.ends_on ?? '', notes: agreement.notes ?? '' };
}

function toPayload(propertyId: string, values: AgreementFormState): OwnerAgreementFormPayload {
  return { property_id: propertyId, owner_id: values.owner_id, agreement_type: values.agreement_type, commission_type: values.commission_type, commission_value: Number(values.commission_value), starts_on: values.starts_on, ends_on: values.ends_on || null, notes: values.notes || null };
}

function getOwnerName(owners: readonly Owner[], ownerId: string) {
  const owner = owners.find((item) => item.id === ownerId);
  return owner?.display_name || owner?.full_name || 'مالك غير معروف';
}

function AgreementRow({ agreement, owners, onEdit, tone }: { agreement: OwnerAgreement; owners: readonly Owner[]; onEdit: (agreement: OwnerAgreement) => void; tone: 'success' | 'info' | 'neutral' }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>{agreement.ends_on ? 'محددة المدة' : 'مفتوحة'}</StatusBadge>
            <span className="font-semibold">{getOwnerName(owners, agreement.owner_id)}</span>
            <span className="text-sm text-muted-foreground">{agreementTypeLabels[agreement.agreement_type]}</span>
          </div>
          <p className="text-sm text-muted-foreground">الفترة: {formatDate(agreement.starts_on)} — {agreement.ends_on ? formatDate(agreement.ends_on) : 'مفتوحة'}</p>
          <p className="text-sm text-muted-foreground">العمولة: {commissionTypeLabels[agreement.commission_type]} · {agreement.commission_type === 'RATE' ? `${formatNumber(agreement.commission_value)}%` : formatMoney(agreement.commission_value)}</p>
          {agreement.notes ? <p className="text-sm leading-7">{agreement.notes}</p> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => onEdit(agreement)}>تعديل آمن</Button>
      </div>
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
  const ownersQuery = useQuery({
    queryKey: ['owners', 'agreement-display'],
    queryFn: listOwners,
  });
  const createMutation = useCreateOwnerAgreement(propertyId);
  const updateMutation = useUpdateOwnerAgreement(propertyId);
  const [editing, setEditing] = useState<OwnerAgreement | null>(null);
  const [form, setForm] = useState<AgreementFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [agreementStep, setAgreementStep] = useState(0);

  const goNextAgreementStep = () => {
    if (agreementStep === 0 && !form.owner_id) {
      setFormError('اختر المالك الذي تغطي ملكيته الفترة.');
      return;
    }
    if (agreementStep === 1) {
      const commissionValue = Number(form.commission_value);
      if (!form.commission_value.trim() || !Number.isFinite(commissionValue) || commissionValue <= 0) {
        setFormError('قيمة العمولة يجب أن تكون رقماً موجباً.');
        return;
      }
    }
    if (agreementStep === 2) {
      if (!form.starts_on) {
        setFormError('تاريخ بداية الاتفاقية مطلوب.');
        return;
      }
      if (form.ends_on && form.ends_on < form.starts_on) {
        setFormError('تاريخ نهاية الاتفاقية يجب ألا يسبق البداية.');
        return;
      }
      // The owner may have been chosen before the period: recompute eligibility
      // with the real domain helper and block advancing when the selected owner
      // no longer covers the whole chosen period.
      const eligibleForPeriod = getEligibleAgreementOwners(ownershipLinks, form.starts_on, form.ends_on || null);
      if (!eligibleForPeriod.some((owner) => owner.id === form.owner_id)) {
        setFormError('المالك المحدد لا تغطي ملكيته الفترة المختارة كاملة — اختر مالكاً آخر أو عدّل التواريخ.');
        return;
      }
    }
    setFormError(null);
    setAgreementStep((current) => Math.min(current + 1, agreementFormSteps.length - 1));
  };

  const stepVisibility = (stepIndex: number) => (agreementStep === stepIndex ? '' : 'max-md:hidden');
  const grouped = useMemo(() => groupAgreementsByTemporalStatus(agreementsQuery.data ?? []), [agreementsQuery.data]);
  const ownershipLinks = ownershipQuery.data ?? [];
  const propertyOwners = useMemo(() => {
    const ownersById = new Map<string, Owner>();
    for (const link of ownershipLinks) {
      if (link.owner?.is_active) ownersById.set(link.owner_id, link.owner);
    }
    return [...ownersById.values()];
  }, [ownershipLinks]);
  const owners = ownersQuery.data ?? propertyOwners;
  const eligibleOwners = useMemo(() => {
    const base = form.starts_on
      ? getEligibleAgreementOwners(ownershipLinks, form.starts_on, form.ends_on || null)
      : propertyOwners;

    if (!editing) return base;

    const currentOwner = owners.find((owner) => owner.id === editing.owner_id);
    if (currentOwner && !base.some((owner) => owner.id === currentOwner.id)) {
      return [currentOwner, ...base];
    }

    return base;
  }, [editing, form.ends_on, form.starts_on, owners, ownershipLinks, propertyOwners]);

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, owner_id: propertyOwners.length === 1 ? propertyOwners[0].id : '' });
    setFormError(null);
    setAgreementStep(0);
    setFormOpen(true);
  };
  const startEdit = (agreement: OwnerAgreement) => { setEditing(agreement); setForm(agreementToForm(agreement)); setFormError(null); setAgreementStep(0); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyForm); setFormError(null); setAgreementStep(0); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const payload = toPayload(propertyId, form);
      assertAgreementOwnerHasOwnership(ownershipLinks, payload);
      if (editing) await updateMutation.mutateAsync({ agreementId: editing.id, payload });
      else await createMutation.mutateAsync(payload);
      toast.success(editing ? 'تم تحديث الاتفاقية ضمن قيود العقود والملكية المرتبطة.' : 'تم إنشاء الاتفاقية.');
      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر حفظ اتفاقية المالك.');
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const loading = agreementsQuery.isLoading || ownershipQuery.isLoading;
  const hasOwnershipLinks = ownershipLinks.length > 0;
  const hasOperationalOwner = propertyOwners.length > 0;
  const hasCurrentAgreement = grouped.current.length > 0;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>اتفاقيات المكتب والمالك</CardTitle>
            <CardDescription>إدارة الاتفاقية السارية والمجدولة والمنتهية لهذا العقار مع حماية العقود وفترات الملكية.</CardDescription>
          </div>
          <Button variant="secondary" onClick={startCreate} disabled={loading || !hasOperationalOwner}>
            <Plus className="me-2 size-4" /> إضافة اتفاقية
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الاتفاقيات وروابط الملكية...</p> : null}
        {agreementsQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل اتفاقيات المالك لهذا العقار.</p> : null}
        {ownershipQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل ملاك العقار وفترات ملكيتهم.</p> : null}
        {!loading && !ownershipQuery.isError && !hasOwnershipLinks ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
            <div>
              <p className="text-sm font-bold text-warning">العقار غير جاهز للتشغيل: لا توجد ملكية سارية.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">اربط مالكاً بالعقار وحدد فترة الملكية، ثم عُد لإنشاء اتفاقية المكتب.</p>
            </div>
            <Button type="button" variant="secondary" className="min-h-11" asChild>
              <Link to="/owners">إدارة علاقات الملكية</Link>
            </Button>
          </div>
        ) : null}
        {!loading && hasOwnershipLinks && !hasOperationalOwner ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3" role="alert">
            <div>
              <p className="text-sm font-bold text-warning">المالك المرتبط غير نشط.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">لا يمكن إنشاء اتفاقية تشغيل جديدة قبل تفعيل المالك أو ربط مالك نشط بالعقار.</p>
            </div>
            <Button type="button" variant="secondary" className="min-h-11" asChild>
              <Link to="/owners">مراجعة المالك والملكية</Link>
            </Button>
          </div>
        ) : null}
        {!loading && hasOperationalOwner && !hasCurrentAgreement ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3" role="status">
            <div>
              <p className="text-sm font-bold text-warning">العقار غير جاهز لعقد إيجار اليوم.</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">أنشئ اتفاقية تشغيل تغطي فترة العقد المطلوبة قبل إضافة العقد.</p>
            </div>
            <Button type="button" variant="secondary" onClick={startCreate}>إنشاء الاتفاقية الآن</Button>
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3"><h3 className="text-sm font-bold">السارية</h3>{grouped.current.length ? grouped.current.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="success" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقية سارية اليوم.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-bold">المجدولة</h3>{grouped.scheduled.length ? grouped.scheduled.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="info" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات مستقبلية.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-bold">المنتهية</h3>{grouped.ended.length ? grouped.ended.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="neutral" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات منتهية.</p>}</section>
        </div>
      </CardContent>
      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={(open) => { if (!open) closeForm(); else setFormOpen(true); }}
        title={editing ? 'تعديل اتفاقية ضمن القيود' : 'إنشاء اتفاقية مكتب ومالك'}
        description="تظهر فقط علاقات الملكية التي تغطي كامل فترة الاتفاقية، وأي تعديل يخرج عقداً قائماً من الفترة سيُرفض."
        className="max-w-2xl"
      >
        <EntityForm.Root className="md:grid-cols-2" onSubmit={submit}>
          <EntityForm.ErrorSummary message={formError} className="md:col-span-2" />
          <div className="md:col-span-2">
            <MobileFormStepperHeader steps={agreementFormSteps} current={agreementStep} />
          </div>

          <EntityForm.Field label="المالك" className={cn('md:col-span-2', stepVisibility(0))}>
            <Select value={form.owner_id} onChange={(e) => setForm((v) => ({ ...v, owner_id: e.target.value }))} required>
              <option value="">اختر المالك الذي تغطي ملكيته الفترة</option>
              {eligibleOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name || owner.full_name}</option>)}
            </Select>
            {form.starts_on && eligibleOwners.length === 0 ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                لا توجد علاقة ملكية تغطي الفترة المختارة كاملة. حدّد تاريخ نهاية مناسباً أو راجع ملكية العقار.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                الاتفاقية المفتوحة تتطلب ملكية مفتوحة، والاتفاقية المحددة يجب أن تقع كاملة داخل فترة الملكية.
              </p>
            )}
          </EntityForm.Field>

          <EntityForm.Field label="نوع الاتفاقية" className={stepVisibility(1)}>
            <Select value={form.agreement_type} onChange={(e) => setForm((v) => ({ ...v, agreement_type: e.target.value as AgreementFormState['agreement_type'] }))}>
              <option value="property_management">إدارة عقار</option>
              <option value="master_lease">استئجار رئيسي</option>
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="نوع العمولة" className={stepVisibility(1)}>
            <Select value={form.commission_type} onChange={(e) => setForm((v) => ({ ...v, commission_type: e.target.value as AgreementFormState['commission_type'] }))}>
              <option value="RATE">نسبة</option>
              <option value="FIXED_MONTHLY">مبلغ شهري ثابت</option>
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="قيمة العمولة" className={stepVisibility(1)}>
            <Input type="number" step={MONEY_STEP} min="0" value={form.commission_value} onChange={(e) => setForm((v) => ({ ...v, commission_value: e.target.value }))} required />
          </EntityForm.Field>

          <EntityForm.Field label="تاريخ البداية" className={stepVisibility(2)}>
            <Input type="date" value={form.starts_on} onChange={(e) => setForm((v) => ({ ...v, starts_on: e.target.value }))} required />
          </EntityForm.Field>
          <EntityForm.Field label="تاريخ النهاية" className={stepVisibility(2)}>
            <Input type="date" value={form.ends_on} onChange={(e) => setForm((v) => ({ ...v, ends_on: e.target.value }))} />
          </EntityForm.Field>
          <EntityForm.Field label="ملاحظات" className={cn('md:col-span-2', stepVisibility(2))}>
            <Textarea value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} />
          </EntityForm.Field>

          <div className={cn('rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2 md:col-span-2', stepVisibility(3))}>
            <p className="font-black">مراجعة الاتفاقية قبل الحفظ</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">المالك</dt><dd className="font-semibold">{getOwnerName(owners, form.owner_id)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">نوع الاتفاقية</dt><dd className="font-semibold">{agreementTypeLabels[form.agreement_type]}</dd></div>
              <div><dt className="text-xs text-muted-foreground">العمولة</dt><dd className="font-semibold">{commissionTypeLabels[form.commission_type]} · {form.commission_type === 'RATE' ? `${formatNumber(Number(form.commission_value) || 0)}%` : formatMoney(Number(form.commission_value) || 0)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">الفترة</dt><dd className="font-semibold">{form.starts_on ? formatDate(form.starts_on) : '—'} — {form.ends_on ? formatDate(form.ends_on) : 'مفتوحة'}</dd></div>
            </dl>
            {form.notes ? <p className="text-xs text-muted-foreground">الملاحظات: {form.notes}</p> : null}
            <p className="text-xs text-muted-foreground border-t border-primary/10 pt-2">
              تُحفظ الاتفاقية ضمن قيود العقود والملكية المرتبطة فقط، ولا تُنشئ قيوداً محاسبية.
            </p>
          </div>

          <MobileFormStepperFooter
            current={agreementStep}
            steps={agreementFormSteps}
            onBack={() => { setFormError(null); setAgreementStep((current) => Math.max(0, current - 1)); }}
            onNext={goNextAgreementStep}
            onCancel={closeForm}
            isSubmitting={saving}
            submitLabel={saving ? 'جار الحفظ...' : 'حفظ الاتفاقية'}
          />
          <EntityForm.Actions className="max-md:hidden md:col-span-2" onCancel={closeForm} isSubmitting={saving} submitLabel={saving ? 'جار الحفظ...' : 'حفظ الاتفاقية'} />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </Card>
  );
}
