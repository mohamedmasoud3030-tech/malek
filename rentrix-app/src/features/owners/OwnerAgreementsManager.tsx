import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import { listOwners, type Owner } from './services/owner-service';
import { groupAgreementsByTemporalStatus, type OwnerAgreement, type OwnerAgreementFormPayload } from './ownerAgreementService';
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
            <span className="font-black">{getOwnerName(owners, agreement.owner_id)}</span>
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
  const ownersQuery = useQuery({ queryKey: ['owners', 'agreement-options'], queryFn: listOwners });
  const createMutation = useCreateOwnerAgreement(propertyId);
  const updateMutation = useUpdateOwnerAgreement(propertyId);
  const [editing, setEditing] = useState<OwnerAgreement | null>(null);
  const [form, setForm] = useState<AgreementFormState>(emptyForm);
  const [message, setMessage] = useState<string | null>(null);
  const grouped = useMemo(() => groupAgreementsByTemporalStatus(agreementsQuery.data ?? []), [agreementsQuery.data]);
  const owners = ownersQuery.data ?? [];

  const startCreate = () => { setEditing(null); setForm({ ...emptyForm, owner_id: owners[0]?.id ?? '' }); setMessage(null); };
  const startEdit = (agreement: OwnerAgreement) => { setEditing(agreement); setForm(agreementToForm(agreement)); setMessage(null); };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const payload = toPayload(propertyId, form);
      if (editing) await updateMutation.mutateAsync({ agreementId: editing.id, payload });
      else await createMutation.mutateAsync(payload);
      setMessage(editing ? 'تم تحديث الاتفاقية ضمن قيود العقود المرتبطة.' : 'تم إنشاء الاتفاقية.');
      setEditing(null); setForm(emptyForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ اتفاقية المالك.');
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>اتفاقيات المكتب والمالك</CardTitle>
            <CardDescription>إدارة الاتفاقية السارية والمجدولة والمنتهية لهذا العقار مع حماية العقود التاريخية.</CardDescription>
          </div>
          <Button variant="secondary" onClick={startCreate}><Plus className="me-2 size-4" /> اتفاقية لاحقة</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {agreementsQuery.isLoading || ownersQuery.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الاتفاقيات والملاك...</p> : null}
        {agreementsQuery.isError ? <p className="text-sm text-destructive">تعذر تحميل اتفاقيات المالك لهذا العقار.</p> : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-3"><h3 className="text-sm font-black">السارية</h3>{grouped.current.length ? grouped.current.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="green" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقية سارية اليوم.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-black">المجدولة</h3>{grouped.scheduled.length ? grouped.scheduled.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="blue" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات مستقبلية.</p>}</section>
          <section className="space-y-3"><h3 className="text-sm font-black">المنتهية</h3>{grouped.ended.length ? grouped.ended.map((a) => <AgreementRow key={a.id} agreement={a} owners={owners} tone="gray" onEdit={startEdit} />) : <p className="text-sm text-muted-foreground">لا توجد اتفاقيات منتهية.</p>}</section>
        </div>
        {(editing || form.owner_id || message) ? (
          <form className="grid gap-4 rounded-2xl border border-border bg-muted/30 p-4 md:grid-cols-2" onSubmit={submit}>
            <div className="md:col-span-2"><h3 className="font-black">{editing ? 'تعديل اتفاقية ضمن القيود' : 'إنشاء اتفاقية'}</h3><p className="text-sm text-muted-foreground">أي تعديل يخرج عقداً قائماً من فترة الاتفاقية سيُرفض من قاعدة البيانات.</p></div>
            {message ? <p role="alert" className="md:col-span-2 text-sm font-bold text-primary">{message}</p> : null}
            <label className="grid gap-2 text-sm font-bold">المالك<Select value={form.owner_id} onChange={(e) => setForm((v) => ({ ...v, owner_id: e.target.value }))} required><option value="">اختر المالك</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.display_name || owner.full_name}</option>)}</Select></label>
            <label className="grid gap-2 text-sm font-bold">نوع الاتفاقية<Select value={form.agreement_type} onChange={(e) => setForm((v) => ({ ...v, agreement_type: e.target.value as AgreementFormState['agreement_type'] }))}><option value="property_management">إدارة عقار</option><option value="master_lease">استئجار رئيسي</option></Select></label>
            <label className="grid gap-2 text-sm font-bold">نوع العمولة<Select value={form.commission_type} onChange={(e) => setForm((v) => ({ ...v, commission_type: e.target.value as AgreementFormState['commission_type'] }))}><option value="RATE">نسبة</option><option value="FIXED_MONTHLY">مبلغ شهري ثابت</option></Select></label>
            <label className="grid gap-2 text-sm font-bold">قيمة العمولة<Input type="number" step="0.01" min="0" value={form.commission_value} onChange={(e) => setForm((v) => ({ ...v, commission_value: e.target.value }))} required /></label>
            <label className="grid gap-2 text-sm font-bold">تاريخ البداية<Input type="date" value={form.starts_on} onChange={(e) => setForm((v) => ({ ...v, starts_on: e.target.value }))} required /></label>
            <label className="grid gap-2 text-sm font-bold">تاريخ النهاية<Input type="date" value={form.ends_on} onChange={(e) => setForm((v) => ({ ...v, ends_on: e.target.value }))} /></label>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">ملاحظات<Textarea value={form.notes} onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))} /></label>
            <div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={saving}><Save className="me-2 size-4" />{saving ? 'جار الحفظ...' : 'حفظ الاتفاقية'}</Button><Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(emptyForm); }}>إلغاء</Button></div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
