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
      toast.success('تم إنشاء ملف ضريبي مسودة — بانتظار اعتماد مدقق مختلف');
      setActionType(null);
      setTaxForm({ tax_code: 'VAT', tax_rate: 5, effective_from: getTodayLocalDateString(), effective_to: '', description: '' });
      void queryClient.invalidateQueries({ queryKey: ['company-tax-profiles'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'تعذر إنشاء الملف الضريبي'),
  });

  const approveTaxMut = useMutation({
    mutationFn: (profile: TaxProfileRecord) => approveTaxProfile({ profile_id: profile.id }),
    onSuccess: () => {
      toast.success('تم اعتماد الملف الضريبي وتفعيله');
      void queryClient.invalidateQueries({ queryKey: ['company-tax-profiles'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'تعذر الاعتماد — يجب أن يعتمد مستخدم مختلف'),
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
      toast.success('تم إنشاء معالجة ضريبة أتعاب مسودة — بانتظار الاعتماد');
      setActionType(null);
      setFeeForm({ fee_kind: 'RATE_MANAGEMENT_FEE', tax_code: 'VAT', tax_rate: 5, effective_from: getTodayLocalDateString(), effective_to: '', description: '' });
      void queryClient.invalidateQueries({ queryKey: ['company-fee-tax-treatments'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'تعذر إنشاء معالجة الأتعاب'),
  });

  const approveFeeMut = useMutation({
    mutationFn: (treatment: FeeTaxTreatmentRecord) => approveFeeTaxTreatment({ treatment_id: treatment.id }),
    onSuccess: () => {
      toast.success('تم اعتماد معالجة ضريبة الأتعاب');
      void queryClient.invalidateQueries({ queryKey: ['company-fee-tax-treatments'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'تعذر الاعتماد'),
  });

  const taxColumns: ColumnDef<TaxProfileRecord>[] = [
    { key: 'version', header: 'الإصدار', render: (r) => <span className="tabular-nums">{r.version_no}</span> },
    { key: 'code', header: 'الكود والنسبة', render: (r) => <span>{r.tax_code} — {r.tax_rate}%</span> },
    { key: 'effective', header: 'سارٍ من', render: (r) => <span dir="ltr">{r.effective_from}{r.effective_to ? ` → ${r.effective_to}` : ''}</span> },
    { key: 'status', header: 'الحالة', render: (r) => <StatusBadge tone={r.status === 'ACTIVE' ? 'success' : r.status === 'DRAFT' ? 'warning' : 'info'}>{r.status}</StatusBadge> },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (r) =>
        r.status === 'DRAFT' && r.created_by !== currentUserId ? (
          <Button size="sm" variant="default" onClick={() => approveTaxMut.mutate(r)}>
            اعتماد
          </Button>
        ) : r.status === 'DRAFT' ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> بانتظار مدقق مختلف
          </span>
        ) : r.status === 'ACTIVE' ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="size-3.5" /> نافذ
          </span>
        ) : null,
    },
  ];

  const feeColumns: ColumnDef<FeeTaxTreatmentRecord>[] = [
    { key: 'kind', header: 'النوع', render: (r) => <span>{r.fee_kind === 'RATE_MANAGEMENT_FEE' ? 'نسبي عند التحصيل' : 'شهري ثابت'}</span> },
    { key: 'version', header: 'الإصدار', render: (r) => <span className="tabular-nums">{r.version_no}</span> },
    { key: 'code', header: 'الكود والنسبة', render: (r) => <span>{r.tax_code} — {r.tax_rate}%</span> },
    { key: 'effective', header: 'سارٍ من', render: (r) => <span dir="ltr">{r.effective_from}</span> },
    { key: 'status', header: 'الحالة', render: (r) => <StatusBadge tone={r.status === 'ACTIVE' ? 'success' : r.status === 'DRAFT' ? 'warning' : 'info'}>{r.status}</StatusBadge> },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (r) =>
        r.status === 'DRAFT' && r.created_by !== currentUserId ? (
          <Button size="sm" variant="default" onClick={() => approveFeeMut.mutate(r)}>
            اعتماد
          </Button>
        ) : r.status === 'DRAFT' ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> بانتظار مدقق مختلف
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            ملفات ضريبة الإيجار — سلطة معتمدة حسب التاريخ
          </CardTitle>
          <CardDescription>
            الضريبة لا تُحسم من company_settings.vat_rate. كل فاتورة تحفظ Snapshot للكود والنسبة والأساس. المسودات تحتاج اعتماد مدقق مختلف (Maker-Checker). التفعيل يرحّل الإصدار السابق إلى SUPERSEDED ويغلق النافذة السابقة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setActionType('createTax')} size="sm" className="gap-1">
              <Plus className="size-4" /> إنشاء ملف ضريبي
            </Button>
          </div>
          <EntityTable aria-label="ملفات ضريبة الإيجار" rows={taxProfilesQuery.data ?? []} columns={taxColumns} keyOf={(r) => r.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>معالجات ضريبة أتعاب الإدارة — سلطة مستقلة</CardTitle>
          <CardDescription>
            أتعاب الإدارة النسبية (RATE) والشهرية الثابتة (FIXED_MONTHLY) لها معالجات ضريبية مستقلة عن ضريبة الإيجار. تفشل مغلقًا FEE_TAX_TREATMENT_MISSING عند النقص. لا يُفترض أن ضريبة الأتعاب صفر.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setActionType('createFeeRate')} size="sm" variant="outline" className="gap-1">
              <Plus className="size-4" /> معالجة نسبية
            </Button>
            <Button onClick={() => setActionType('createFeeFixed')} size="sm" variant="outline" className="gap-1">
              <Plus className="size-4" /> معالجة شهرية ثابتة
            </Button>
          </div>
          <EntityTable aria-label="معالجات ضريبة الأتعاب" rows={feeTreatmentsQuery.data ?? []} columns={feeColumns} keyOf={(r) => r.id} />
        </CardContent>
      </Card>

      <EntityForm.Overlay
        open={actionType === 'createTax'}
        onOpenChange={(open) => !open && setActionType(null)}
        title="إنشاء ملف ضريبة إيجار"
        description="يُنشئ مسودة versioned مع نافذة فعالية. يحتاج اعتماد مدقق مختلف ليصبح ACTIVE. الكتابة عبر RPC محكوم فقط."
        visualVariant="operational"
      >
        <EntityForm.Root
          onSubmit={(e) => {
            e.preventDefault();
            if (!taxForm.tax_code || !taxForm.effective_from) return;
            createTaxMut.mutate();
          }}
        >
          <EntityForm.Section title="بيانات الملف الضريبي">
            <EntityForm.Field label="كود الضريبة *">
              <Select required value={taxForm.tax_code} onChange={(e) => setTaxForm((f) => ({ ...f, tax_code: e.target.value }))}>
                {taxCodesQuery.data?.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name_ar} ({c.name_en})
                  </option>
                ))}
              </Select>
            </EntityForm.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="النسبة % *">
                <Input required type="number" min="0" max="100" step="0.001" value={taxForm.tax_rate} onChange={(e) => setTaxForm((f) => ({ ...f, tax_rate: Number(e.target.value) || 0 }))} />
              </EntityForm.Field>
              <EntityForm.Field label="سارٍ من *">
                <Input required type="date" value={taxForm.effective_from} onChange={(e) => setTaxForm((f) => ({ ...f, effective_from: e.target.value }))} />
              </EntityForm.Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="سارٍ إلى (اختياري)">
                <Input type="date" value={taxForm.effective_to} onChange={(e) => setTaxForm((f) => ({ ...f, effective_to: e.target.value }))} />
              </EntityForm.Field>
              <EntityForm.Field label="وصف">
                <Input value={taxForm.description} onChange={(e) => setTaxForm((f) => ({ ...f, description: e.target.value }))} placeholder="وصف اختياري..." />
              </EntityForm.Field>
            </div>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={createTaxMut.isPending ? 'جارٍ الإنشاء...' : 'إنشاء مسودة'} onCancel={() => setActionType(null)} isSubmitting={createTaxMut.isPending} />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={actionType === 'createFeeRate' || actionType === 'createFeeFixed'}
        onOpenChange={(open) => !open && setActionType(null)}
        title={actionType === 'createFeeRate' ? 'إنشاء معالجة ضريبة أتعاب نسبية' : 'إنشاء معالجة ضريبة أتعاب شهرية ثابتة'}
        description="معالجة مستقلة عن ضريبة الإيجار، versioned، تحتاج اعتماد مدقق مختلف."
        visualVariant="operational"
      >
        <EntityForm.Root
          onSubmit={(e) => {
            e.preventDefault();
            if (!feeForm.tax_code || !feeForm.effective_from) return;
            createFeeMut.mutate();
          }}
        >
          <EntityForm.Section title="بيانات المعالجة">
            <EntityForm.Field label="كود الضريبة *">
              <Select required value={feeForm.tax_code} onChange={(e) => setFeeForm((f) => ({ ...f, tax_code: e.target.value }))}>
                {taxCodesQuery.data?.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name_ar}
                  </option>
                ))}
              </Select>
            </EntityForm.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="النسبة % *">
                <Input required type="number" min="0" max="100" step="0.001" value={feeForm.tax_rate} onChange={(e) => setFeeForm((f) => ({ ...f, tax_rate: Number(e.target.value) || 0 }))} />
              </EntityForm.Field>
              <EntityForm.Field label="سارٍ من *">
                <Input required type="date" value={feeForm.effective_from} onChange={(e) => setFeeForm((f) => ({ ...f, effective_from: e.target.value }))} />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="وصف">
              <Input value={feeForm.description} onChange={(e) => setFeeForm((f) => ({ ...f, description: e.target.value }))} placeholder="وصف..." />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions submitLabel={createFeeMut.isPending ? 'جارٍ الإنشاء...' : 'إنشاء مسودة'} onCancel={() => setActionType(null)} isSubmitting={createFeeMut.isPending} />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </div>
  );
}
