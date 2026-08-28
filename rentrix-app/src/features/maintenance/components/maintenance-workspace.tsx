import { Clock3, Flame, PlusCircle, Printer, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RegisterAttention, RegisterHeading, RegisterMetricStrip } from '@/components/layout/register-summary';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { MaintenanceDetailsOverlay, MaintenanceResolveOverlay } from './maintenance-detail-resolve-overlays';
import { MaintenanceList } from './maintenance-list';
import { maintenancePriorityLabels, maintenanceStatusLabels } from './maintenance-list';
import { MaintenanceRequestForm } from './maintenance-request-form';
import type { MaintenancePriorityFilter, MaintenanceStatusFilter } from '../maintenance-helpers';
import { maintenanceAttentionLabels, type MaintenanceAttentionFilter } from '../maintenance-attention';
import { useMaintenancePageController } from '../useMaintenancePageController';
import { formatCount } from '@/lib/formatters';


export type MaintenanceWorkspaceMode = 'standalone' | 'embedded';

export type MaintenanceWorkspaceProps = Readonly<{
  mode?: MaintenanceWorkspaceMode;
}>;

export function MaintenanceWorkspace({ mode = 'standalone' }: MaintenanceWorkspaceProps) {
  const controller = useMaintenancePageController();
  const documentSettings = useDocumentSettings();

  const activeFilters = useMemo<readonly ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];
    if (controller.statusFilter !== 'all') {
      items.push({
        key: 'status',
        label: 'الحالة',
        value: maintenanceStatusLabels[controller.statusFilter as keyof typeof maintenanceStatusLabels] ?? controller.statusFilter,
        onRemove: () => controller.setStatusFilter('all'),
      });
    }
    if (controller.priorityFilter !== 'all') {
      items.push({
        key: 'priority',
        label: 'الأولوية',
        value: maintenancePriorityLabels[controller.priorityFilter as keyof typeof maintenancePriorityLabels] ?? controller.priorityFilter,
        onRemove: () => controller.setPriorityFilter('all'),
      });
    }
    if (controller.attentionFilter !== 'all') {
      items.push({
        key: 'attention',
        label: 'المتابعة',
        value: maintenanceAttentionLabels[controller.attentionFilter],
        onRemove: () => controller.setAttentionFilter('all'),
      });
    }
    if (controller.propertyFilterId) {
      const propertyLabel = controller.properties.find(
        (property) => property.id === controller.propertyFilterId,
      )?.title ?? controller.propertyFilterId;
      items.push({
        key: 'property',
        label: 'العقار',
        value: propertyLabel,
        onRemove: () => controller.setPropertyFilterId(''),
      });
    }
    return items;
  }, [controller]);

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
      isReady: documentSettings.isReady,
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
      disabled={!documentSettings.isReady}
      className="min-h-11 gap-2 font-bold"
    >
      <Printer className="size-4 text-primary" aria-hidden="true" />
      طباعة كشف الصيانة A4
    </Button>
  );

  const createAction = (
    <Button
      type="button"
      onClick={controller.openCreateForm}
      className="min-h-11 border border-info/30 bg-info-bg text-info hover:bg-info/15"
    >
      <PlusCircle className="me-2 size-4" aria-hidden="true" />
      طلب صيانة جديد
    </Button>
  );

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row">
      {printAction}
      {createAction}
    </div>
  );

  const body = (
    <>
      {mode === 'embedded' ? (
        <div className="flex flex-wrap justify-end gap-2">
          {actions}
        </div>
      ) : null}

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
        actions={controller.hasFilters ? (
          <Button type="button" variant="secondary" onClick={clearAllFilters}>
            مسح الفلاتر
          </Button>
        ) : undefined}
      />

      <ActiveFilterBar filters={activeFilters} onClearAll={clearAllFilters} />

      <section
        data-maintenance-register
        className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
      >
        <header className="border-b border-border/70 px-3 py-2.5 sm:px-4">
          <RegisterHeading
            title="سجل طلبات الصيانة"
            extra={<RegisterAttention count={controller.maintenanceSummary.urgent} label="عاجلة" />}
          />
        </header>

        <div className="p-3 sm:p-4">
          <AsyncContentState
            status={controller.isLoading
              ? 'loading'
              : controller.hasLoadError
                ? 'error'
                : controller.filteredMaintenanceRows.length === 0
                  ? 'empty'
                  : 'ready'}
            error={controller.loadError}
            errorTitle="تعذر تحميل طلبات الصيانة"
            errorAction={(
              <Button type="button" onClick={controller.retryMaintenanceWorkspace}>
                إعادة المحاولة
              </Button>
            )}
            emptyTitle="لا توجد طلبات صيانة"
            emptyDescription={controller.hasFilters
              ? 'لا توجد طلبات تطابق الفلاتر الحالية.'
              : 'أضف طلب صيانة جديد للبدء.'}
          >
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
              onViewDetails={controller.openDetailsRequest}
              onEdit={controller.openEditForm}
              onStatusAction={controller.handleStatusAction}
            />
          </AsyncContentState>
        </div>
      </section>

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

      <MaintenanceDetailsOverlay
        request={controller.detailsRequest}
        providerOptions={controller.providerOptions}
        providerCategories={controller.providerCategories}
        onOpenChange={(open) => {
          if (!open) controller.closeDetailsRequest();
        }}
      />

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
    </>
  );

  if (mode === 'embedded') {
    return (
      <div className="space-y-5">
        {body}
      </div>
    );
  }

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="طلبات الصيانة"
        count={controller.visibleMaintenanceRows.length}
        primaryAction={createAction}
        secondaryActions={printAction}
      />
      {body}
    </PageLayout>
  );
}
