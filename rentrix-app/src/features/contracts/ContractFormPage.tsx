import { useNavigate, useParams, Link } from '@tanstack/react-router';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RouteLoadingState } from '@/components/loading-state';
import { useContractForm, contractStatusLabels, contractStatusValues, paymentCycleLabels, paymentCycleValues, buildContractUnitOptionLabel, isUnitSelectableForContract, type ContractFormValues } from './useContractForm';

function fieldError(message?: string) { return message ? <span className="text-xs font-bold text-destructive">{message}</span> : null; }

export function ContractFormPage() {
  const { contractId } = useParams({ strict: false }) as { contractId?: string };
  const navigate = useNavigate();

  const {
    form,
    isEdit,
    submitting,
    contractQuery,
    propertiesQuery,
    peopleQuery,
    paymentTermsQuery,
    unitsQuery,
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
    handleSubmit,
  } = useContractForm({
    contractId,
    onSuccess: () => navigate({ to: '/contracts' }),
  });

  if (isEdit && contractQuery.isLoading) return <RouteLoadingState />;

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        title={isEdit ? 'تعديل عقد' : 'إنشاء عقد'}
        subtitle="العقد رقم، المستأجر، الوحدة، التواريخ، قيمة الإيجار، الحالة، والملاحظات."
        backTo="/contracts"
      />
      <Card>
        <CardContent className="pt-6">
          <EntityForm.Section>
            <EntityForm.Root className="gap-5 md:grid-cols-2" onSubmit={form.handleSubmit(handleSubmit)}>
              <label className="grid gap-2 text-sm font-bold">العقار<Select {...form.register('property_id')}><option value="">اختر العقار</option>{propertiesQuery.data?.rows.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</Select>{fieldError(form.formState.errors.property_id?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">الوحدة<Select {...form.register('unit_id')} disabled={!form.watch('property_id')}><option value="">اختر الوحدة</option>{unitsQuery.data?.map((unit) => <option key={unit.id} value={unit.id} disabled={!isUnitSelectableForContract({ unit, currentLinkedUnitId })}>{buildContractUnitOptionLabel({ unit, property: selectedProperty })}</option>)}</Select>{fieldError(form.formState.errors.unit_id?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">المستأجر<Select {...form.register('tenant_id')}><option value="">اختر المستأجر</option>{peopleQuery.data?.rows.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</Select>{fieldError(form.formState.errors.tenant_id?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">الحالة<Select {...form.register('status')}>{contractStatusValues.map((status) => <option key={status} value={status}>{contractStatusLabels[status]}</option>)}</Select>{fieldError(form.formState.errors.status?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">تاريخ البداية<Input type="date" {...form.register('start_date')} />{fieldError(form.formState.errors.start_date?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">تاريخ النهاية<Input type="date" {...form.register('end_date')} />{fieldError(form.formState.errors.end_date?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">قيمة الإيجار<Input type="number" step="0.01" inputMode="decimal" min="0.01" {...form.register('rent_amount')} />{fieldError(form.formState.errors.rent_amount?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">دورة السداد<Select {...form.register('payment_cycle')}>{paymentCycleValues.map((cycle) => <option key={cycle} value={cycle}>{paymentCycleLabels[cycle]}</option>)}</Select>{fieldError(form.formState.errors.payment_cycle?.message)}</label>
              <label className="grid gap-2 text-sm font-bold">شرط السداد<Select {...form.register('payment_terms_id')}><option value="">بدون قالب شروط</option>{(paymentTermsQuery.data ?? []).filter((term) => term.is_active !== false).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</Select>{fieldError(form.formState.errors.payment_terms_id?.message)}</label>
              <label className="grid gap-2 text-sm font-bold md:col-span-2">سبب الإلغاء<Textarea {...form.register('cancellation_reason')} placeholder="يظهر عند إلغاء العقد" /></label>
              <label className="grid gap-2 text-sm font-bold md:col-span-2">ملاحظات<Textarea {...form.register('notes')} placeholder="ملاحظات العقد" /></label>
              {form.formState.errors.root && <div className="md:col-span-2 rounded-md bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">{form.formState.errors.root.message}</div>}
              <div className="flex justify-end gap-3 md:col-span-2"><Button variant="secondary" asChild><Link to="/contracts">إلغاء</Link></Button><Button type="submit" disabled={submitting}>{submitting ? 'جار الحفظ...' : 'حفظ العقد'}</Button></div>
            </EntityForm.Root>
          </EntityForm.Section>
        </CardContent>
      </Card>
    </div>
  );
}
