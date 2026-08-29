import { useState } from 'react';
import { CheckCircle2, Clock, Plus, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useActiveCompanyId } from '@/hooks/use-company';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listTaxCodes,
  listTaxProfiles,
  listFeeTaxTreatments,
  createTaxProfile,
  approveTaxProfile,
  createFeeTaxTreatment,
  approveFeeTaxTreatment,
  type TaxProfileRecord,
  type FeeTaxTreatmentRecord,
} from './tax-authority-service';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';

function statusLabel(status: string) {
  if (status === 'ACTIVE') return 'ساري';
  if (status === 'DRAFT') return 'مسودة';
  if (status === 'SUPERSEDED') return 'سابق';
  return 'غير نشط';
}

function statusTone(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'SUPERSEDED') return 'info';
  return 'neutral';
}

function friendlyTaxError(action: 'create' | 'approve') {
  return action === 'approve'
    ? 'تعذر الاعتماد. تأكد أن مستخدمًا مخوّلًا مختلفًا هو من يعتمد المسودة.'
    : 'تعذر حفظ الإعداد الضريبي. راجع البيانات وحاول مرة أخرى.';
}

export function TaxAuthorityWorkspace() {
  const companyId = useActiveCompanyId();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const queryClient = useQueryClient();

  const [actionType, setActionType] = useState<'createTax' | 'createFeeRate' | 'createFeeFixed' | null>(null);
  const [taxForm, setTaxForm] = useState({ tax_code: 'VAT', tax_rate: 5, effective_from: getTodayLocalDateString(), effective_to: '', description: '' });
  const [feeForm, setFeeForm] = useState({ fee_kind: 'RATE_MANAGEMENT_FEE' as const, tax_code: 'VAT', tax_rate: 5, effective_from: getTodayLocalDateString(), effective_to: '', description: '' });

  const taxCodesQuery = useQuery({ queryKey: ['tax-codes'], queryFn: listTaxCodes });
  const taxProfilesQuery = useQuery({ queryKey: ['company-tax-profiles', companyId], enabled: Boolean(companyId), queryFn: listTaxProfiles });
  const feeTreatmentsQuery = useQuery({ queryKey: ['company-fee-tax-treatments', companyId], enabled: Boolean(companyId), queryFn: listFeeTaxTreatments });

  const createTaxMut = useMutation({
    mutationFn: () =>
      createTaxProfile({
        tax_code: taxForm.tax_code,
        tax_rate: taxForm.tax_rate,
        effective_from: taxForm.effective_from,
        effective_to: taxForm.effective_to || null,
        description: taxForm.description || null,
        request_id: crypto.randomUUID(),
      }),
    onSuccess: () => {
      toast.success('تم حفظ إعداد ضريبة الإيجار كمسودة بانتظار الاعتماد');
      setActionType(null);
      setTaxForm({ tax_code: 'VAT', tax_rate: 5, effective_from: getTodayLocalDateString(), effective_to: '', description: '' });
      void queryClient.invalidateQueries({ queryKey: ['company-tax-profiles'] });
    },
    onError: () => toast.error(friendlyTaxError('create')),
  });

  const approveTaxMut = useMutation({
    mutationFn: (profile: TaxProfileRecord) => approveTaxProfile({ profile_id: profile.id }),
    onSuccess: () => {
      toast.success('تم اعتماد إعداد ضريبة الإيجار');
      void queryClient.invalidateQueries({ queryKey: ['company-tax-profiles'] });
    },
    onError: () => toast.error(friendlyTaxError('approve')),
  });

  const createFeeMut = useMutation({
    mutationFn: () => {
      const kind = actionType === 'createFeeRate' ? 'RATE_MANAGEMENT_FEE' : 'FIXED_MONTHLY';
      return createFeeTaxTreatment({
        fee_kind: kind as never,
        tax_code: feeForm.tax_code,
        tax_rate: feeForm.tax_rate,
        effective_from: feeForm.effective_from,
        effective_to: feeForm.effective_to || null,
        description: feeForm.description || null,
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      toast.success('تم حفظ إعداد ضريبة الأتعاب كمسودة بانتظار الاعتماد');
      setActionType(null);
      setFeeForm({ fee_kind: 'RATE_MANAGEMENT_FEE', tax_code: 'VAT', tax_rate: 5, effective_from: getTodayLocalDateString(), effective_to: '', description: '' });
      void queryClient.invalidateQueries({ queryKey: ['company-fee-tax-treatments'] });
    },
    onError: () => toast.error(friendlyTaxError('create')),
  });

  const approveFeeMut = useMutation({
    mutationFn: (treatment: FeeTaxTreatmentRecord) => approveFeeTaxTreatment({ treatment_id: treatment.id }),
    onSuccess: () => {
      toast.success('تم اعتماد إعداد ضريبة الأتعاب');
      void queryClient.invalidateQueries({ queryKey: ['company-fee-tax-treatments'] });
    },
    onError: () => toast.error(friendlyTaxError('approve')),
  });

  const taxColumns: ColumnDef<TaxProfileRecord>[] = [
    { key: 'version', header: 'الإصدار', render: (row) => <span className="tabular-nums">{row.version_no}</span> },
    { key: 'code', header: 'الضريبة', render: (row) => <span>{row.tax_code} — {row.tax_rate}%</span> },
    { key: 'effective', header: 'الفترة', render: (row) => <span dir="ltr">{row.effective_from}{row.effective_to ? ` → ${row.effective_to}` : ''}</span> },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge> },
    {
      key: 'actions',
      header: 'الإجراء',
      render: (row) =>
        row.status === 'DRAFT' && row.created_by !== currentUserId ? (
          <Button size="sm" className="min-h-11" onClick={() => approveTaxMut.mutate(row)}>اعتماد</Button>
        ) : row.status === 'DRAFT' ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden="true" /> ينتظر اعتماد مستخدم آخر</span>
        ) : row.status === 'ACTIVE' ? (
          <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" /> مستخدم حاليًا</span>
        ) : null,
    },
  ];

  const feeColumns: ColumnDef<FeeTaxTreatmentRecord>[] = [
    { key: 'kind', header: 'النوع', render: (row) => <span>{row.fee_kind === 'RATE_MANAGEMENT_FEE' ? 'أتعاب نسبية عند التحصيل' : 'أتعاب شهرية ثابتة'}</span> },
    { key: 'version', header: 'الإصدار', render: (row) => <span className="tabular-nums">{row.version_no}</span> },
    { key: 'code', header: 'الضريبة', render: (row) => <span>{row.tax_code} — {row.tax_rate}%</span> },
    { key: 'effective', header: 'سارٍ من', render: (row) => <span dir="ltr">{row.effective_from}</span> },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge> },
    {
      key: 'actions',
      header: 'الإجراء',
      render: (row) =>
        row.status === 'DRAFT' && row.created_by !== currentUserId ? (
          <Button size="sm" className="min-h-11" onClick={() => approveFeeMut.mutate(row)}>اعتماد</Button>
        ) : row.status === 'DRAFT' ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" aria-hidden="true" /> ينتظر اعتماد مستخدم آخر</span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4" data-tax-settings-workspace>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-5" aria-hidden="true" /> ضريبة الإيجار</CardTitle>
          <CardDescription>حدد الضريبة والنسبة وفترة السريان. أي تعديل جديد يُحفظ كمسودة ويحتاج اعتماد مستخدم مخوّل مختلف قبل أن يصبح ساريًا.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex ms-auto w-full justify-end sm:w-auto">
            <Button onClick={() => setActionType('createTax')} size="sm" className="min-h-11 gap-1"><Plus className="size-4" aria-hidden="true" /> إعداد جديد</Button>
          </div>
          <EntityTable aria-label="إعدادات ضريبة الإيجار" rows={taxProfilesQuery.data ?? []} columns={taxColumns} keyOf={(row) => row.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ضريبة أتعاب الإدارة</CardTitle>
          <CardDescription>يمكن أن تختلف ضريبة الأتعاب النسبية عن الأتعاب الشهرية. أكمل الإعداد المناسب قبل تسجيل العمليات المرتبطة به.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setActionType('createFeeRate')} size="sm" variant="outline" className="min-h-11 gap-1"><Plus className="size-4" aria-hidden="true" /> أتعاب نسبية</Button>
            <Button onClick={() => setActionType('createFeeFixed')} size="sm" variant="outline" className="min-h-11 gap-1"><Plus className="size-4" aria-hidden="true" /> أتعاب شهرية</Button>
          </div>
          <EntityTable aria-label="إعدادات ضريبة أتعاب الإدارة" rows={feeTreatmentsQuery.data ?? []} columns={feeColumns} keyOf={(row) => row.id} />
        </CardContent>
      </Card>

      <EntityForm.Overlay
        open={actionType === 'createTax'}
        onOpenChange={(open) => !open && setActionType(null)}
        title="إعداد ضريبة الإيجار"
        description="احفظ الإعداد كمسودة، ثم اعتمده من مستخدم مخوّل مختلف ليصبح ساريًا."
        visualVariant="operational"
      >
        <EntityForm.Root onSubmit={(event) => { event.preventDefault(); if (!taxForm.tax_code || !taxForm.effective_from) return; createTaxMut.mutate(); }}>
          <EntityForm.Section title="بيانات الضريبة">
            <EntityForm.Field label="نوع الضريبة *">
              <Select required value={taxForm.tax_code} onChange={(event) => setTaxForm((current) => ({ ...current, tax_code: event.target.value }))}>
                {taxCodesQuery.data?.map((code) => <option key={code.code} value={code.code}>{code.name_ar} — {code.code}</option>)}
              </Select>
            </EntityForm.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="النسبة % *"><Input required type="number" min="0" max="100" step="0.001" value={taxForm.tax_rate} onChange={(event) => setTaxForm((current) => ({ ...current, tax_rate: Number(event.target.value) || 0 }))} /></EntityForm.Field>
              <EntityForm.Field label="سارٍ من *"><Input required type="date" value={taxForm.effective_from} onChange={(event) => setTaxForm((current) => ({ ...current, effective_from: event.target.value }))} /></EntityForm.Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="سارٍ إلى (اختياري)"><Input type="date" value={taxForm.effective_to} onChange={(event) => setTaxForm((current) => ({ ...current, effective_to: event.target.value }))} /></EntityForm.Field>
              <EntityForm.Field label="ملاحظة"><Input value={taxForm.description} onChange={(event) => setTaxForm((current) => ({ ...current, description: event.target.value }))} placeholder="ملاحظة اختيارية" /></EntityForm.Field>
            </div>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={createTaxMut.isPending ? 'جارٍ الحفظ...' : 'حفظ كمسودة'} onCancel={() => setActionType(null)} isSubmitting={createTaxMut.isPending} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={actionType === 'createFeeRate' || actionType === 'createFeeFixed'}
        onOpenChange={(open) => !open && setActionType(null)}
        title={actionType === 'createFeeRate' ? 'إعداد ضريبة الأتعاب النسبية' : 'إعداد ضريبة الأتعاب الشهرية'}
        description="احفظ الإعداد كمسودة، ثم اعتمده من مستخدم مخوّل مختلف ليصبح ساريًا."
        visualVariant="operational"
      >
        <EntityForm.Root onSubmit={(event) => { event.preventDefault(); if (!feeForm.tax_code || !feeForm.effective_from) return; createFeeMut.mutate(); }}>
          <EntityForm.Section title="بيانات الضريبة">
            <EntityForm.Field label="نوع الضريبة *">
              <Select required value={feeForm.tax_code} onChange={(event) => setFeeForm((current) => ({ ...current, tax_code: event.target.value }))}>
                {taxCodesQuery.data?.map((code) => <option key={code.code} value={code.code}>{code.name_ar} — {code.code}</option>)}
              </Select>
            </EntityForm.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="النسبة % *"><Input required type="number" min="0" max="100" step="0.001" value={feeForm.tax_rate} onChange={(event) => setFeeForm((current) => ({ ...current, tax_rate: Number(event.target.value) || 0 }))} /></EntityForm.Field>
              <EntityForm.Field label="سارٍ من *"><Input required type="date" value={feeForm.effective_from} onChange={(event) => setFeeForm((current) => ({ ...current, effective_from: event.target.value }))} /></EntityForm.Field>
            </div>
            <EntityForm.Field label="ملاحظة"><Input value={feeForm.description} onChange={(event) => setFeeForm((current) => ({ ...current, description: event.target.value }))} placeholder="ملاحظة اختيارية" /></EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={createFeeMut.isPending ? 'جارٍ الحفظ...' : 'حفظ كمسودة'} onCancel={() => setActionType(null)} isSubmitting={createFeeMut.isPending} />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
