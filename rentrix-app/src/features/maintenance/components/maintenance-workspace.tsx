import { Clock3, PlusCircle, Printer, Wrench, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { RegisterAttention, RegisterMetricStrip } from '@/components/layout/register-summary';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { documentService } from '@/services/documents/DocumentService';
import { toReportDocumentPayload, type ReportDocumentData } from '@/services/documents/documentPayloadAdapters';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { useAuth } from '@/hooks/use-auth';
import { normalizeMaintenanceStatus } from '@/lib/maintenanceStatus';
import type { Maintenance } from '../maintenance-service';
import {
  printMaintenanceWorkOrder,
  downloadMaintenanceWorkOrderPdf,
  printMaintenanceCompletion,
  downloadMaintenanceCompletionPdf,
} from '../documents/maintenance-documents';
import { MaintenanceDetailsOverlay, MaintenanceResolveOverlay } from './maintenance-detail-resolve-overlays';
import { MaintenanceList } from './maintenance-list';
import { defaultMaintenanceColumns, maintenanceColumnOptions, maintenancePriorityLabels, maintenanceStatusLabels } from './maintenance-list';
import { MaintenanceRequestForm } from './maintenance-request-form';
import type { MaintenancePriorityFilter, MaintenanceStatusFilter } from '../maintenance-helpers';
import { maintenanceAttentionLabels, type MaintenanceAttentionFilter, type MaintenanceAttentionFlag } from '../maintenance-attention';
import {
  getMaintenanceStatusActionPermission,
  getPrimaryMaintenanceAction,
  useMaintenancePageController,
  type MaintenanceAction,
} from '../useMaintenancePageController';
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
    controller.setQuery('');
    controller.setStatusFilter('all');
    controller.setPriorityFilter('all');
    controller.setPropertyFilterId('');
    controller.setAttentionFilter('all');
  };

  const selectedPropertyLabel = controller.properties.find((property) => property.id === controller.propertyFilterId)?.title;
  const activeFilters: ActiveFilterItem[] = [
    ...(controller.query.trim() ? [{ key: 'query', label: 'بحث', value: controller.query.trim(), onRemove: () => controller.setQuery('') }] : []),
    ...(controller.statusFilter !== 'all' ? [{ key: 'status', label: 'الحالة', value: maintenanceStatusLabels[controller.statusFilter as keyof typeof maintenanceStatusLabels] ?? String(controller.statusFilter), onRemove: () => controller.setStatusFilter('all') }] : []),
    ...(controller.priorityFilter !== 'all' ? [{ key: 'priority', label: 'الأولوية', value: maintenancePriorityLabels[controller.priorityFilter as keyof typeof maintenancePriorityLabels] ?? String(controller.priorityFilter), onRemove: () => controller.setPriorityFilter('all') }] : []),
    ...(controller.attentionFilter !== 'all' ? [{ key: 'attention', label: 'المتابعة', value: maintenanceAttentionLabels[controller.attentionFilter], onRemove: () => controller.setAttentionFilter('all') }] : []),
    ...(controller.propertyFilterId ? [{ key: 'property', label: 'العقار', value: selectedPropertyLabel ?? 'عقار محدد', onRemove: () => controller.setPropertyFilterId('') }] : []),
  ];

  const currencyLabel =
    documentSettings.companySettings.currencySymbol ||
    documentSettings.companySettings.currency;

  // Compact clickable substitutes for the awaiting-closure / stalled /
  // schedule-missed metric cards — each sets the existing attention filter
  // instead of duplicating the Select below as a read-only number.
  type AttentionChip = { id: MaintenanceAttentionFlag; label: string; count: number; icon?: LucideIcon };
  const attentionChips: AttentionChip[] = controller.isLoading
    ? []
    : (
        [
          { id: 'awaiting_closure', label: maintenanceAttentionLabels.awaiting_closure, count: controller.attentionSummary.awaitingClosure },
          { id: 'stalled', label: maintenanceAttentionLabels.stalled, count: controller.attentionSummary.stalled, icon: Clock3 },
          { id: 'schedule_missed', label: maintenanceAttentionLabels.schedule_missed, count: controller.attentionSummary.scheduleMissed },
        ] satisfies AttentionChip[]
      ).filter((chip) => chip.count > 0);

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

  /**
   * Row-level document actions. Work orders exist for any real request that
   * is actually actionable field work (not cancelled). The completion
   * certificate requires lifecycle truth: a canonical resolved/closed status
   * AND a recorded completion timestamp — a certificate is never offered
   * merely because a request exists, and printing never mutates state.
   */
  const maintenanceDocumentActions = (row: Maintenance) => {
    const status = normalizeMaintenanceStatus(row.status);
    const propertyTitle = controller.properties.find((property) => property.id === row.property_id)?.title ?? null;
    const unitNumber = controller.allUnits.find((unit) => unit.id === row.unit_id)?.unit_number ?? null;
    const providerName = controller.providerOptions.find((provider) => provider.id === row.service_provider_id)?.name ?? null;
    const reference = row.reference ?? row.no ?? null;
    const settings = documentSettings.companySettings;
    const disabled = !documentSettings.isReady;

    const actions: { id: string; label: string; kind: 'print' | 'download'; disabled?: boolean; onClick: () => void }[] = [];

    if (status !== 'cancelled') {
      const workOrderParams = { maintenance: row, settings, propertyTitle, unitNumber, reference, assignedProvider: providerName };
      actions.push(
        { id: 'work-order-print', label: 'طباعة أمر العمل', kind: 'print', disabled, onClick: () => void printMaintenanceWorkOrder(workOrderParams) },
        { id: 'work-order-pdf', label: 'أمر العمل PDF', kind: 'download', disabled, onClick: () => void downloadMaintenanceWorkOrderPdf(workOrderParams) },
      );
    }

    const completionTimestamp = row.completed_at ?? row.resolved_at ?? null;
    if ((status === 'resolved' || status === 'closed') && completionTimestamp) {
      const completionParams = {
        maintenance: row,
        settings,
        propertyTitle,
        unitNumber,
        reference,
        completionDate: completionTimestamp.slice(0, 10),
        workPerformed: row.work_description ?? null,
        providerName,
        notes: row.notes ?? null,
      };
      actions.push(
        { id: 'completion-print', label: 'طباعة شهادة الإنجاز', kind: 'print', disabled, onClick: () => void printMaintenanceCompletion(completionParams) },
        { id: 'completion-pdf', label: 'شهادة الإنجاز PDF', kind: 'download', disabled, onClick: () => void downloadMaintenanceCompletionPdf(completionParams) },
      );
    }

    return actions;
  };

  const maintenanceActionsPending =
    controller.updateStatusMutation.isPending || controller.resolveMutation.isPending;

  /**
   * The one next action for the request open in the details overlay, projected
   * from the same canonical status-action matrix the register row menu uses and
   * gated by the same permissions. Terminal states yield null, so the preview
   * can never offer an invalid step.
   */
  const detailsNextAction = useMemo<MaintenanceAction | null>(() => {
    const row = controller.detailsRequest;
    if (!row) return null;
    return getPrimaryMaintenanceAction(normalizeMaintenanceStatus(row.status), (status) =>
      canAccess(getMaintenanceStatusActionPermission(status)),
    );
  }, [canAccess, controller.detailsRequest]);

  /**
   * Runs through `controller.handleStatusAction`, so every existing guard is
   * preserved: closure still opens the cost/confirmation overlay and
   * cancellation still requires a reason.
   */
  const runDetailsNextAction = (action: MaintenanceAction) => {
    const row = controller.detailsRequest;
    if (!row || controller.hasLoadError || maintenanceActionsPending) return;
    controller.closeDetailsRequest();
    controller.handleStatusAction(row, action.status);
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
          ]}
        />
        {attentionChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="فلاتر المتابعة التشغيلية السريعة">
            {attentionChips.map((chip) => {
              const isActive = controller.attentionFilter === chip.id;
              const Icon = chip.icon;
              return (
                <Button
                  key={chip.id}
                  type="button"
                  variant="outline"
                  onClick={() => controller.setAttentionFilter(isActive ? 'all' : chip.id)}
                  aria-pressed={isActive}
                  data-maintenance-attention-chip={chip.id}
                  className={cn(
                    'min-h-11 gap-1.5 rounded-full px-2.5 text-[11px] font-bold',
                    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25',
                    isActive
                      ? 'border-warning bg-warning-bg text-warning-text hover:bg-warning-bg hover:text-warning-text'
                      : 'border-border/70 bg-card text-muted-foreground hover:bg-warning-bg/60 hover:text-warning-text',
                  )}
                >
                  {Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
                  <span>{chip.label}</span>
                  <span className="tabular-nums">{formatCount(chip.count)}</span>
                </Button>
              );
            })}
          </div>
        ) : null}
      </section>

      <FilterBar
        searchValue={controller.query}
        onSearchChange={controller.setQuery}
        searchPlaceholder="ابحث بالعنوان أو المرجع أو العقار أو الوحدة أو مزود الخدمة"
        searchAriaLabel="بحث في طلبات الصيانة"
        activeFilters={activeFilters}
        onClearAllFilters={clearAllFilters}
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
            {printAction}
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
          actionsPending={maintenanceActionsPending}
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
          documentActions={maintenanceDocumentActions}
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
        attention={controller.detailsAttention}
        nextAction={detailsNextAction}
        nextActionDisabled={maintenanceActionsPending || controller.hasLoadError}
        onRunNextAction={detailsNextAction ? runDetailsNextAction : undefined}
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
    >
      {body}
    </EmbeddableWorkspace>
  );
}
