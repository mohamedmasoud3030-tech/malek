import { useNavigate, useParams } from '@tanstack/react-router';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RouteLoadingState } from '@/components/loading-state';
import { Card, CardContent } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  buildContractUnitOptionLabel,
  contractStatusLabels,
  contractStatusValues,
  isUnitSelectableForContract,
  paymentCycleLabels,
  paymentCycleValues,
  useContractForm,
} from './useContractForm';

function fieldError(message?: string) {
  return message ? <span className="text-xs font-bold text-destructive">{message}</span> : null;
}

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
    unitConflictsQuery,
    unitConflictsByUnitId,
    agreementCoverageQuery,
    selectedProperty,
    currentLinkedUnitId,
    handleSubmit,
  } = useContractForm({
    contractId,
    onSuccess: () => navigate({ to: '/contracts' }),
  });

  if (isEdit && contractQuery.isLoading) return <RouteLoadingState />;

  const propertyId = form.watch('property_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');
  const prerequisitesLoading =
    propertiesQuery.isLoading ||
    peopleQuery.isLoading ||
    unitsQuery.isLoading ||
    unitConflictsQuery.isLoading ||
    agreementCoverageQuery.isLoading;
  const hasSelectedPeriod = Boolean(propertyId && startDate && endDate);
  const dependencyError =
    propertiesQuery.isError || peopleQuery.isError
      ? 'تعذر تحميل بيانات العقارات أو المستأجرين. أعد تحميل الصفحة ثم حاول مرة أخرى.'
      : null;
  const coverageError = agreementCoverageQuery.isError
    ? 'تعذر التحقق من اتفاقية المالك. أعد المحاولة قبل حفظ العقد.'
    : hasSelectedPeriod && !agreementCoverageQuery.isLoading && !agreementCoverageQuery.data
      ? 'لا توجد اتفاقية إدارة تغطي كامل فترة العقد. انتقل إلى صفحة العقار لإنشاء أو تحديث اتفاقية الإدارة أولاً.'
      : null;

  return (
    <PageLayout dir="rtl" size="wide">
      <div className="space-y-6">
        <EntityDetailHeader
          title={isEdit ? 'تعديل عقد' : 'إنشاء عقد'}
          subtitle="العقد رقم، المستأجر، الوحدة، التواريخ، قيمة الإيجار، الحالة، والملاحظات."
          backTo="/contracts"
        />
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <EntityForm.Section>
              <EntityForm.Root
                className="gap-5 md:grid-cols-2"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
                <EntityForm.ErrorSummary className="md:col-span-2" message={dependencyError} />
                <EntityForm.ErrorSummary className="md:col-span-2" message={coverageError} />
                <EntityForm.ErrorSummary
                  className="md:col-span-2"
                  message={form.formState.errors.root?.message}
                />

                <EntityForm.Field label="العقار">
                  <Select {...form.register('property_id')}>
                    <option value="">اختر العقار</option>
                    {propertiesQuery.data?.rows.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.title}
                      </option>
                    ))}
                  </Select>
                  {fieldError(form.formState.errors.property_id?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="الوحدة">
                  <Select {...form.register('unit_id')} disabled={!propertyId}>
                    <option value="">اختر الوحدة</option>
                    {unitsQuery.data?.map((unit) => (
                      <option
                        key={unit.id}
                        value={unit.id}
                        disabled={
                          !isUnitSelectableForContract({
                            unit,
                            currentLinkedUnitId,
                            conflictsByUnitId: unitConflictsByUnitId,
                          })
                        }
                      >
                        {buildContractUnitOptionLabel({ unit, property: selectedProperty })}
                      </option>
                    ))}
                  </Select>
                  {fieldError(form.formState.errors.unit_id?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="المستأجر">
                  <Select {...form.register('tenant_id')}>
                    <option value="">اختر المستأجر</option>
                    {peopleQuery.data?.rows.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </Select>
                  {fieldError(form.formState.errors.tenant_id?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="الحالة">
                  <Select {...form.register('status')}>
                    {contractStatusValues.map((status) => (
                      <option key={status} value={status}>
                        {contractStatusLabels[status]}
                      </option>
                    ))}
                  </Select>
                  {fieldError(form.formState.errors.status?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="تاريخ البداية">
                  <Input type="date" {...form.register('start_date')} />
                  {fieldError(form.formState.errors.start_date?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="تاريخ النهاية">
                  <Input type="date" {...form.register('end_date')} />
                  {fieldError(form.formState.errors.end_date?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="قيمة الإيجار">
                  <Input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    min="0.01"
                    {...form.register('rent_amount')}
                  />
                  {fieldError(form.formState.errors.rent_amount?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="دورة السداد">
                  <Select {...form.register('payment_cycle')}>
                    {paymentCycleValues.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {paymentCycleLabels[cycle]}
                      </option>
                    ))}
                  </Select>
                  {fieldError(form.formState.errors.payment_cycle?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="شرط السداد">
                  <Select {...form.register('payment_terms_id')}>
                    <option value="">بدون قالب شروط</option>
                    {(paymentTermsQuery.data ?? [])
                      .filter((term) => term.is_active !== false)
                      .map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                  </Select>
                  {fieldError(form.formState.errors.payment_terms_id?.message)}
                </EntityForm.Field>

                <EntityForm.Field label="سبب الإلغاء" className="md:col-span-2">
                  <Textarea
                    {...form.register('cancellation_reason')}
                    placeholder="يظهر عند إلغاء العقد"
                  />
                </EntityForm.Field>

                <EntityForm.Field label="ملاحظات" className="md:col-span-2">
                  <Textarea {...form.register('notes')} placeholder="ملاحظات العقد" />
                </EntityForm.Field>

                <EntityForm.Actions
                  className="md:col-span-2"
                  onCancel={() => navigate({ to: '/contracts' })}
                  isSubmitting={submitting}
                  submitDisabled={submitting || prerequisitesLoading || Boolean(coverageError)}
                  submitLabel={
                    prerequisitesLoading
                      ? 'جار تجهيز بيانات العقد...'
                      : submitting
                        ? 'جار الحفظ...'
                        : 'حفظ العقد'
                  }
                />
              </EntityForm.Root>
            </EntityForm.Section>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
