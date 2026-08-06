import { AlertCircle, Clock, Flame, PlusCircle, Printer, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { MaintenanceDetailsOverlay, MaintenanceResolveOverlay } from './maintenance-detail-resolve-overlays';
import { MaintenanceList } from './maintenance-list';
import { maintenancePriorityLabels, maintenanceStatusLabels } from './maintenance-list';
import { MaintenanceRequestForm } from './maintenance-request-form';
import type { MaintenancePriorityFilter, MaintenanceStatusFilter } from '../maintenance-helpers';
import { useMaintenancePageController } from '../useMaintenancePageController';

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function MaintenanceMetric({
  label,
  value,
  hint,
  icon: Icon,
}: Readonly<{
  label: string;
  value: number;
  hint: string;
  icon: typeof Wrench;
}>) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
      <div
        className="absolute inset-inline-end-0 inset-block-start-0 size-24 rounded-full bg-primary/7 blur-2xl transition-colors group-hover:bg-primary/12"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{formatCount(value)}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

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
  };

  const currencyLabel =
    documentSettings.companySettings.currencySymbol ||
    documentSettings.companySettings.currency;

  const handlePrintMaintenanceList = () => {
    if (!documentSettings.isReady) return;
    const today = getTodayLocalDateString();
    const report = {
      reportTitle: 'كشف بلاغات وطلبات الصيانة الميدانية',
      reportType: 'Maintenance_Requests_Report',
      periodFrom: today,
      periodTo: today,
      sections: [
        {
          title: 'جدول طلبات الصيانة والتكلفة والأولوية',
          rows: controller.filteredMaintenanceRows.map((row) => ({
            label: `${row.title} - (${maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority})`,
            value: `الحالة: ${maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status} | المسؤول: ${row.assigned_to || row.technician_name || 'غير محدد'} | التكلفة: ${row.cost ? `${row.cost} ${currencyLabel}` : '—'}`,
          })),
        },
      ],
      totalSummary: `عدد الطلبات المدرجة: ${controller.filteredMaintenanceRows.length} طلب صيانة`,
    } satisfies ReportDocumentData;
    void runDocumentAction(
      () => documentService.printDocument('generic_report', {
        settings: documentSettings.companySettings,
        payload: toReportDocumentPayload(report),
      }),
      'تعذرت طباعة كشف الصيانة.',
    );
  };

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row">
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
      <Button
        type="button"
        onClick={controller.openCreateForm}
        className="min-h-11"
      >
        <PlusCircle className="me-2 size-4" aria-hidden="true" />
        طلب صيانة جديد
      </Button>
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

      <section
        data-maintenance-summary
        aria-label="ملخص تشغيل الصيانة"
        className="grid gap-3 lg:grid-cols-[minmax(17rem,1.05fr)_minmax(0,2fr)]"
      >
        <article className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-elevated">
          <div
            className="absolute -inset-inline-end-12 -inset-block-start-16 size-48 rounded-full bg-destructive/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-sidebar-foreground/65">طلبات تحتاج انتباهًا فوريًا</p>
                <p className="mt-2 text-4xl font-black tabular-nums">
                  {controller.isLoading ? '—' : formatCount(controller.maintenanceSummary.urgent)}
                </p>
              </div>
              <span className="grid size-12 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent text-warning">
                <Flame className="size-6" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-xs font-medium leading-5 text-sidebar-foreground/72">
              أولوية عاجلة ضمن الفلاتر الحالية. افتح الطلب لتحديد المسؤول أو بدء التنفيذ.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-sidebar-foreground/72">
              <span>{formatCount(controller.maintenanceSummary.open)} مفتوحة</span>
              <span>{formatCount(controller.maintenanceSummary.inProgress)} قيد التنفيذ</span>
            </div>
          </div>
        </article>

        <div className="grid gap-3 sm:grid-cols-3">
          <MaintenanceMetric
            label="إجمالي الطلبات"
            value={controller.maintenanceSummary.total}
            hint="ضمن الفلاتر الحالية"
            icon={Wrench}
          />
          <MaintenanceMetric
            label="طلبات مفتوحة"
            value={controller.maintenanceSummary.open}
            hint="تحتاج إلى بدء المتابعة"
            icon={AlertCircle}
          />
          <MaintenanceMetric
            label="قيد التنفيذ"
            value={controller.maintenanceSummary.inProgress}
            hint="يعمل عليها الفريق"
            icon={Clock}
          />
        </div>
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
              <option value="resolved">تم الحل</option>
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
        <header className="flex flex-col gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                <Wrench className="size-4.5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-black">سجل طلبات الصيانة</h2>
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
              {formatCount(controller.filteredMaintenanceRows.length)} طلب ضمن العرض الحالي.
            </p>
          </div>
          {controller.maintenanceSummary.urgent > 0 ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-black text-destructive">
              <Flame className="size-3.5" aria-hidden="true" />
              {formatCount(controller.maintenanceSummary.urgent)} عاجلة
            </span>
          ) : null}
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
              rows={controller.filteredMaintenanceRows}
              properties={controller.properties}
              allUnits={controller.allUnits}
              actionsPending={
                controller.updateStatusMutation.isPending ||
                controller.resolveMutation.isPending
              }
              onViewDetails={controller.setDetailsRequest}
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
        firstError={controller.firstCreateError}
        onOpenChange={controller.setShowForm}
        onSubmit={controller.onSubmit}
      />

      <MaintenanceDetailsOverlay
        request={controller.detailsRequest}
        onOpenChange={(open) => {
          if (!open) controller.setDetailsRequest(null);
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
      <div data-visual-wave="malek-pro" className="space-y-5">
        {body}
      </div>
    );
  }

  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <PageHeader
        title="طلبات الصيانة"
        description="غرفة متابعة للطلبات العاجلة والمفتوحة وقيد التنفيذ مع الإجراءات والطباعة من مكان واحد."
        count={controller.filteredMaintenanceRows.length}
        primaryAction={actions}
      />
      {body}
    </PageLayout>
  );
}
