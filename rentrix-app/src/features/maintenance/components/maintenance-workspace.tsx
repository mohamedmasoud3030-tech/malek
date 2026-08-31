import { Clock3, Flame, PlusCircle, Printer, Wrench } from 'lucide-react';
import { useState } from 'react';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { RegisterAttention, RegisterMetricStrip } from '@/components/layout/register-summary';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { useAuth } from '@/hooks/use-auth';
import { MaintenanceDetailsOverlay, MaintenanceResolveOverlay } from './maintenance-detail-resolve-overlays';
import { MaintenanceList } from './maintenance-list';
import { defaultMaintenanceColumns, maintenanceColumnOptions, maintenancePriorityLabels, maintenanceStatusLabels } from './maintenance-list';
import { MaintenanceRequestForm } from './maintenance-request-form';
import type { MaintenancePriorityFilter, MaintenanceStatusFilter } from '../maintenance-helpers';
import type { MaintenanceAttentionFilter } from '../maintenance-attention';
import { useMaintenancePageController } from '../useMaintenancePageController';
import { formatCount } from '@/lib/formatters';

export type MaintenanceWorkspaceMode = 'standalone' | 'embedded';

export type MaintenanceWorkspaceProps = Readonly<{
  mode?: MaintenanceWorkspaceMode;
}>;

export function MaintenanceWorkspace({ mode = 'standalone' }: MaintenanceWorkspaceProps) {
  const controller = useMaintenancePageController();
  const documentSettings = useDocumentSettings();
  const { canAccess } = useAuth();
  const canCreateMaintenance = canAccess('maintenance.create');
  const canEditMaintenance = canAccess('maintenance.edit');
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultMaintenanceColumns]);
  const canApproveMaintenance = canAccess('maintenance.approve');

  const clearAllFilters = () => {
    controller.setStatusFilter('all');
    controller.setPriorityFilter('all');
    controller.setPropertyFilterId('');
    controller.setAttentionFilter('all');
  };

  const currencyLabel =
    documentSettings.companySettings.currencySymbol ||
    documentSettings.companySettings.currency;

  const handlePrintMaintenanceList = () => {
    void runGuardedDocumentAction({
      isReady: documentSettings.isReady && !controller.hasLoadError,
      operation: () => {
        const today = getTodayLocalDateString();
        const report = {
          reportTitle: 'كشف بلاغات وطلبات الصيانة الميدانية',
          reportType: 'Maintenance_Requests_Report',
          periodFrom: today,
          periodTo: today,
          sections: [
            {
              title: 'جدول طلبات الصيانة والتكلفة والأولوية',
              rows: controller.visibleMaintenanceRows.map((row) => ({
                label: `${row.title} - (${maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority})`,
                value: `الحالة: ${maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status} | المسؤول: ${row.assigned_to || row.technician_name || 'غير محدد'} | التكلفة: ${row.cost ? `${row.cost} ${currencyLabel}` : '—'}`,
              })),
            },
          ],
          totalSummary: `عدد الطلبات المدرجة: ${controller.visibleMaintenanceRows.length} طلب صيانة`,
        } satisfies ReportDocumentData;
        return documentService.printDocument('generic_report', {
          settings: documentSettings.companySettings,
          payload: toReportDocumentPayload(report),
        });
      },
      fallbackMessage: 'تعذرت طباعة كشف الصيانة.',
    });
  };

  const printAction = (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrintMaintenanceList}
      disabled={!documentSettings.isReady || controller.hasLoadError}
      className="min-h-11 gap-2 font-bold"
    >
      <Printer className="size-4 text-primary" aria-hidden="true" />
      طباعة كشف الصيانة A4
    </Button>
  );

  const createAction = canCreateMaintenance ? (
    <Button
      type="button"
      onClick={() => { if (!controller.hasLoadError) controller.openCreateForm(); }}
      disabled={controller.hasLoadError}
      className="min-h-11"
    >
      <PlusCircle className="me-2 size-4" aria-hidden="true" />
      طلب صيانة جديد
    </Button>
  ) : null;

  const body = (
    <>
      {!documentSettings.isReady && !documentSettings.isLoading ? (
        <DocumentReadinessNotice />
      ) : null}

      <section data-maintenance-summary aria-label="ملخص تشغيل الصيانة" className="space-y-2">
        <RegisterAttention
          count={controller.isLoading ? 0 : controller.maintenanceSummary.urgent}
          label="طلبات تحتاج انتباهًا فوريًا"
          description="أولوية عاجلة ضمن الفلاتر الحالية."
        />
        <RegisterMetricStrip
          aria-label="ملخص تشغيل الصيانة"
          items={[
            { id: 'total', label: 'الطلبات', value: formatCount(controller.maintenanceSummary.total), icon: Wrench, hideWhenEmpty: true },
            { id: 'open', label: 'مفتوحة', value: formatCount(controller.maintenanceSummary.open), hideWhenEmpty: true },
            { id: 'progress', label: 'قيد التنفيذ', value: formatCount(controller.maintenanceSummary.inProgress), hideWhenEmpty: true },
            { id: 'urgent', label: 'عاجلة', value: formatCount(controller.maintenanceSummary.urgent), icon: Flame, tone: 'danger', hideWhenEmpty: true },
            { id: 'awaiting-closure', label: 'بانتظار الإغلاق', value: formatCount(controller.attentionSummary.awaitingClosure), tone: 'warning', hideWhenEmpty: true },
            { id: 'stalled', label: 'متوقفة عن التقدم', value: formatCount(controller.attentionSummary.stalled), icon: Clock3, tone: 'warning', hideWhenEmpty: true },
            { id: 'schedule-missed', label: 'تجاوزت الموعد', value: formatCount(controller.attentionSummary.scheduleMissed), tone: 'warning', hideWhenEmpty: true },
          ]}
        />
      </section>

      <FilterBar
        filters={(
          <>
            <Select
              aria-label="تصفية حسب الحالة"
              value={String(controller.statusFilter)}
              onChange={(event) => controller.setStatusFilter(event.target.value as MaintenanceStatusFilter)}
            >
              <option value="all">كل الحالات</option>
              <option value="open">مفتوح</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="resolved">تم التنفيذ</option>
              <option value="closed">مغلق</option>
            </Select>
            <Select
              aria-label="تصفية حسب الأولوية"
              value={String(controller.priorityFilter)}
              onChange={(event) => controller.setPriorityFilter(event.target.value as MaintenancePriorityFilter)}
            >
              <option value="all">كل الأولويات</option>
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </Select>
            <Select
              aria-label="تصفية حسب المتابعة التشغيلية"
              value={controller.attentionFilter}
              onChange={(event) => controller.setAttentionFilter(event.target.value as MaintenanceAttentionFilter)}
            >
              <option value="all">كل الطلبات</option>
              <option value="awaiting_closure">بانتظار الإغلاق</option>
              <option value="stalled">متوقفة عن التقدم</option>
              <option value="schedule_missed">تجاوزت موعد الزيارة</option>
            </Select>
            <Select
              aria-label="تصفية حسب العقار"
              value={controller.propertyFilterId}
              onChange={(event) => controller.setPropertyFilterId(event.target.value)}
            >
              <option value="">كل العقارات</option>
              {controller.properties.map((property) => (
                <option key={property.id} value={property.id}>{property.title}</option>
              ))}
            </Select>
          </>
        )}
        actions={(
          <>
            <DataTableColumnsMenu
              columns={maintenanceColumnOptions}
              visibleKeys={visibleColumnKeys}
              onChange={setVisibleColumnKeys}
            />
            {controller.hasFilters ? (
              <Button type="button" variant="secondary" onClick={clearAllFilters}>
                مسح الفلاتر
              </Button>
            ) : null}
          </>
        )}
      />

      <section data-maintenance-register className="min-w-0 space-y-2.5">
        <MaintenanceList
          rows={controller.visibleMaintenanceRows}
          attentionByRequestId={controller.attentionByRequestId}
          properties={controller.properties}
          allUnits={controller.allUnits}
          providerOptions={controller.providerOptions}
          actionsPending={
            controller.updateStatusMutation.isPending ||
            controller.resolveMutation.isPending
          }
          isLoading={controller.isLoading}
          error={controller.hasLoadError ? controller.loadError : undefined}
          onRetry={controller.retryMaintenanceWorkspace}
          emptyTitle="لا توجد طلبات صيانة"
          emptyDescription={controller.hasFilters
            ? 'لا توجد طلبات تطابق الفلاتر الحالية.'
            : canCreateMaintenance
              ? 'أضف طلب صيانة جديد للبدء.'
              : 'لا توجد طلبات صيانة مسجلة الآن.'}
          emptyAction={canCreateMaintenance && !controller.hasFilters && !controller.hasLoadError ? (
            <Button type="button" onClick={controller.openCreateForm}>
              <PlusCircle className="me-2 size-4" aria-hidden="true" />
              طلب صيانة جديد
            </Button>
          ) : undefined}
          onViewDetails={controller.openDetailsRequest}
          onEdit={(request) => { if (!controller.hasLoadError) controller.openEditForm(request); }}
          onStatusAction={(request, action) => { if (!controller.hasLoadError) controller.handleStatusAction(request, action); }}
          visibleColumnKeys={visibleColumnKeys}
        />
      </section>

      {((controller.editingRequest && canEditMaintenance) || (!controller.editingRequest && canCreateMaintenance)) ? (
        <MaintenanceRequestForm
          open={controller.showForm}
          isEditing={Boolean(controller.editingRequest)}
          isEditingResolvedRequest={controller.isEditingResolvedRequest}
          isSubmitting={
            controller.createMutation.isPending ||
            controller.updateRequestMutation.isPending
          }
          isLoadingUnits={controller.unitsQuery.isLoading}
          form={controller.form}
          formPropertyId={controller.formPropertyId}
          properties={controller.properties}
          units={controller.units}
          providerCategories={controller.providerCategories}
          providerOptions={controller.filteredProviderOptions}
          firstError={controller.firstCreateError}
          onOpenChange={controller.setShowForm}
          onSubmit={controller.onSubmit}
        />
      ) : null}

      <MaintenanceDetailsOverlay
        request={controller.detailsRequest}
        providerOptions={controller.providerOptions}
        providerCategories={controller.providerCategories}
        onOpenChange={(open) => {
          if (!open) controller.closeDetailsRequest();
        }}
      />

      {canApproveMaintenance ? (
        <MaintenanceResolveOverlay
          target={controller.resolveTarget}
          form={controller.resolveForm}
          isSubmitting={controller.resolveMutation.isPending}
          firstError={controller.firstResolveError}
          onOpenChange={(open) => {
            if (!open) controller.setResolveTarget(null);
          }}
          onSubmit={controller.submitResolve}
        />
      ) : null}
    </>
  );

  return (
    <EmbeddableWorkspace
      embedded={mode === 'embedded'}
      workspaceName="maintenance"
      dir="rtl"
      lang="ar"
      size="wide"
      title="طلبات الصيانة"
      count={controller.visibleMaintenanceRows.length}
      primaryAction={createAction ?? undefined}
      secondaryActions={printAction}
    >
      {body}
    </EmbeddableWorkspace>
  );
}
