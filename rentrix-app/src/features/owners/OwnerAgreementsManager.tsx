import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EntityForm } from '@/components/ui/entity-form';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import { listPropertyOwners, type Owner } from './services/owner-service';
import {
  assertAgreementOwnerHasOwnership,
  getEligibleAgreementOwners,
  groupAgreementsByTemporalStatus,
  type OwnerAgreement,
  type OwnerAgreementFormPayload,
} from './ownerAgreementService';
import { useCreateOwnerAgreement, useOwnerAgreements, useUpdateOwnerAgreement } from './useOwnerAgreements';
import { useQuery } from '@tanstack/react-query';

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

function AgreementRow({ agreement, owners, onEdit, tone }: { agreement: OwnerAgreement; owners: readonly Owner[]; onEdit: (agreement: OwnerAgreement) => void; tone: 'green' | 'blue' | 'gray' }) {
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
  const createMutation = useCreateOwnerAgreement(propertyId);
  const updateMutation = useUpdateOwnerAgreement(propertyId);
  const [editing, setEditing] = useState<OwnerAgreement | null>(null);
  const [form, setForm] = useState<AgreementFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const grouped = useMemo(() => groupAgreementsByTemporalStatus(agreementsQuery.data ?? []), [agreementsQuery.data]);
  const ownershipLinks = ownershipQuery.data ?? [];
  const owners = useMemo(() => {
    const ownersById = new Map<string, Owner>();
    for (const link of ownershipLinks) {
      if (link.owner) ownersById.set(link.owner_id, link.owner);
    }
    return [...ownersById.values()];
  }, [ownershipLinks]);
  const eligibleOwners = useMemo(
    () => form.starts_on
      ? getEligibleAgreementOwners(ownershipLinks, form.starts_on, form.ends_on || null)
      : owners,
    [form.ends_on, form.starts_on, owners, ownershipLinks],
  );

  const startCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, owner_id: owners.length === 1 ? owners[0].id : '' });
    setFormError(null);
    setFormOpen(true);
  };
  const startEdit = (agreement: OwnerAgreement) => { setEditing(agreement); setForm(agreementToForm(agreement)); setFormError(null); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyForm); setFormError(null); };

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

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>اتفاقيات المكتب والمالك</CardTitle>
            <CardDescription>إدارة الاتفاقية السارية والمجدولة والمنتهية لهذا العقار مع حماية العقود وفترات الملكية.</CardDescription>
          </div>
          <Button variant="secondary" onClick={startCreate} disabled={loading || !hasOwnershipLinks}>
            <Plus className="me-2 size-4" /> اتفاقية لاحقة
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الاتفاقيات وروابط الملكية...</p> : null}
        {agreementsQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل اتفاقيات المالك لهذا العقار.</p> : null}
        {ownershipQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل ملاك العقار وفترات ملكيتهم.</p> : null}
        {!loading && !ownershipQuery.isError && !hasOwnershipLinks ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            اربط مالكاً بالعقار وحدد فترة ملكيته قبل إنشاء اتفاقية مكتب ومالك.
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3"><h3 className="text-sm font-bold">السارية</h3>{grouped.current.length ? grouped.current.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="green" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقية سارية اليوم.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-bold">المجدولة</h3>{grouped.scheduled.length ? grouped.scheduled.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="blue" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات مستقبلية.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-bold">المنتهية</h3>{grouped.ended.length ? grouped.ended.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="gray" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات منتهية.</p>}</section>
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
          <EntityForm.Field label="تاريخ البداية">
            <Input type="date" value={form.starts_on} onChange={(e) => setForm((v) => ({ ...v, starts_on: e.target.value }))} required />
          </EntityForm.Field>
          <EntityForm.Field label="تاريخ النهاية">
            <Input type="date" value={form.ends_on} onChange={(e) => setForm((v) => ({ ...v, ends_on: e.target.value }))} />
          </EntityForm.Field>
          <EntityForm.Field label="المالك" className="md:col-span-2">
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
          <EntityForm.Field label="نوع الاتفاقية">
            <Select value={form.agreement_type} onChange={(e) => setForm((v) => ({ ...v, agreement_type: e.target.value as AgreementFormState['agreement_type'] }))}>
              <option value="property_management">إدارة عقار</option>
              <option value="master_lease">استئجار رئيسي</option>
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="نوع العمولة">
            <Select value={form.commission_type} onChange={(e) => setForm((v) => ({ ...v, commission_type: e.target.value as AgreementFormState['commission_type'] }))}>
              <option value="RATE">نسبة</option>
              <option value="FIXED_MONTHLY">مبلغ شهري ثابت</option>
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="قيمة العمولة">
            <Input type="number" step="0.01" min="0" value={form.commission_value} onChange={(e) => setForm((v) => ({ ...v, commission_value: e.target.value }))} required />
          </EntityForm.Field>
          <EntityForm.Field label="ملاحظات" className="md:col-span-2">
            <Textarea value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} />
          </EntityForm.Field>
          <EntityForm.Actions className="md:col-span-2" onCancel={closeForm} isSubmitting={saving} submitLabel={saving ? 'جار الحفظ...' : 'حفظ الاتفاقية'} />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </Card>
  );
}
