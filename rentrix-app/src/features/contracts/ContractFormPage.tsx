import { useNavigate, useParams } from '@tanstack/react-router';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RouteLoadingState } from '@/components/loading-state';
import { Card, CardContent } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { ContractAgreementMissingAlert } from './components/ContractAgreementMissingAlert';
import { ContractFormFields } from './components/ContractFormFields';
import { useContractForm } from './useContractForm';

export function ContractFormPage() {
  const { contractId } = useParams({ strict: false }) as { contractId?: string };
  const navigate = useNavigate();
  const controller = useContractForm({
    contractId,
    onSuccess: () => navigate({ to: '/contracts' }),
  });
  const {
    form,
    isEdit,
    contractQuery,
    propertiesQuery,
    peopleQuery,
    agreementCoverageQuery,
    selectedProperty,
    handleSubmit,
  } = controller;

  if (isEdit && contractQuery.isLoading) return <RouteLoadingState />;

  const propertyId = form.watch('property_id');
  const startDate = form.watch('start_date');
  const endDate = form.watch('end_date');
  const hasSelectedPeriod = Boolean(propertyId && startDate && endDate);
  const dependencyError =
    propertiesQuery.isError || peopleQuery.isError
      ? 'تعذر تحميل بيانات العقارات أو المستأجرين. أعد تحميل الصفحة ثم حاول مرة أخرى.'
      : null;
  const coverageMissing =
    agreementCoverageQuery.isError ||
    (hasSelectedPeriod && !agreementCoverageQuery.isLoading && !agreementCoverageQuery.data);

  return (
    <PageLayout dir="rtl" size="wide">
      <div className="space-y-6">
        <EntityDetailHeader
          title={isEdit ? 'تعديل عقد' : 'إنشاء عقد'}
          subtitle="العقد رقم، المستأجر، الوحدة، التواريخ، قيمة الإيجار، الحالة، والملاحظات."
          backTo="/contracts"
        />
        {coverageMissing && (
          <ContractAgreementMissingAlert
            property={selectedProperty}
            startDate={startDate || ''}
            endDate={endDate || ''}
            isLoading={agreementCoverageQuery.isLoading}
            hasError={agreementCoverageQuery.isError}
            hasSelectedPeriod={hasSelectedPeriod}
            hasAgreement={Boolean(agreementCoverageQuery.data)}
            onRetry={() => agreementCoverageQuery.refetch()}
          />
        )}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <EntityForm.Section>
              <ContractFormFields
                controller={controller}
                onSubmit={form.handleSubmit(handleSubmit)}
                onCancel={() => navigate({ to: '/contracts' })}
                dependencyError={dependencyError}
                coverageError={coverageMissing ? 'لا توجد اتفاقية إدارة تغطي كامل فترة العقد. راجع الإشعار أعلاه.' : null}
              />
            </EntityForm.Section>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}