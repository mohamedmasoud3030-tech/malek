import { AlertCircle, Clock, Flame, PlusCircle, Printer, Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/ui/filter-bar';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { DocumentTemplates } from '@/services/documents/DocumentTemplates';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { MaintenanceDetailsOverlay, MaintenanceResolveOverlay } from './maintenance-detail-resolve-overlays';
import { MaintenanceList } from './maintenance-list';
import { maintenancePriorityLabels, maintenanceStatusLabels } from './maintenance-list';
import { MaintenanceRequestForm } from './maintenance-request-form';
import type { MaintenancePriorityFilter, MaintenanceStatusFilter } from '../maintenance-helpers';
import { useMaintenancePageController } from '../useMaintenancePageController';

const summaryCards = [
  { key: 'total', label: 'إجمالي الطلبات', sub: 'ضمن الفلاتر الحالية', icon: Wrench, accent: 'primary' },
  { key: 'open', label: 'طلبات مفتوحة', sub: 'تحتاج إلى بدء المتابعة', icon: AlertCircle, accent: 'sky' },
  { key: 'inProgress', label: 'قيد التنفيذ', sub: 'طلبات يعمل عليها الفريق', icon: Clock, accent: 'amber' },
  { key: 'urgent', label: 'طلبات عاجلة', sub: 'أولوية فورية', icon: Flame, accent: 'rose' },
] as const;

export type MaintenanceWorkspaceMode = 'standalone' | 'embedded';

export type MaintenanceWorkspaceProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) —
   * used by the legacy /maintenance route when visited directly.
   * embedded: renders only the workspace body — used inside the operations
   * hub, which already supplies its own page shell and section header.
   */
  mode?: MaintenanceWorkspaceMode;
}>;

/**
 * Owns all maintenance workspace UI: KPI summary, filters, list, and the
 * create/edit/details/resolve overlays. Shared verbatim between the
 * standalone /maintenance route and the embedded operations hub tab so
 * business logic, queries, and mutations are never duplicated.
 */
export function MaintenanceWorkspace({ mode = 'standalone' }: MaintenanceWorkspaceProps) {
  const c = useMaintenancePageController();
  const documentSettings = useDocumentSettings();

  const activeFilters = useMemo<readonly ActiveFilterItem[]>(() => {
    const items: ActiveFilterItem[] = [];
    if (c.statusFilter !== 'all') {
      items.push({
        key: 'status',
        label: 'الحالة',
        value: maintenanceStatusLabels[c.statusFilter as keyof typeof maintenanceStatusLabels] ?? c.statusFilter,
        onRemove: () => c.setStatusFilter('all'),
      });
    }
    if (c.priorityFilter !== 'all') {
      items.push({
        key: 'priority',
        label: 'الأولوية',
        value: maintenancePriorityLabels[c.priorityFilter as keyof typeof maintenancePriorityLabels] ?? c.priorityFilter,
        onRemove: () => c.setPriorityFilter('all'),
      });
    }
    if (c.propertyFilterId) {
      const propLabel = c.properties.find((p) => p.id === c.propertyFilterId)?.title ?? c.propertyFilterId;
      items.push({
        key: 'property',
        label: 'العقار',
        value: propLabel,
        onRemove: () => c.setPropertyFilterId(''),
      });
    }
    return items;
  }, [c]);

  const clearAllFilters = () => {
    c.setStatusFilter('all');
    c.setPriorityFilter('all');
    c.setPropertyFilterId('');
  };

  // Real currency label for the printed cost column — never a hardcoded
  // symbol; falls back to the configured currency code, and only renders at
  // all once document settings are ready.
  const currencyLabel = documentSettings.settings.currencySymbol || documentSettings.settings.currency;

  const handlePrintMaintenanceList = () => {
    // Only real company identity reaches the document engine. With incomplete
    // settings the print action is blocked entirely — no placeholder branding.
    if (!documentSettings.isReady) return;
    const todayStr = getTodayLocalDateString();
    DocumentTemplates.printReportDocument(
      {
        reportTitle: 'كشف بلاغات وطلبات الصيانة الميدانية',
        reportType: 'Maintenance_Requests_Report',
        periodFrom: todayStr,
        periodTo: todayStr,
        sections: [
          {
            title: 'جدول طلبات الصيانة والتكلفة والأولوية',
            rows: c.filteredMaintenanceRows.map((r) => ({
              label: `${r.title} - (${maintenancePriorityLabels[r.priority as keyof typeof maintenancePriorityLabels] ?? r.priority})`,
              value: `الحالة: ${maintenanceStatusLabels[r.status as keyof typeof maintenanceStatusLabels] ?? r.status} | المسؤول: ${r.assigned_to || r.technician_name || 'غير محدد'} | التكلفة: ${r.cost ? `${r.cost} ${currencyLabel}` : '—'}`,
            })),
          },
        ],
        totalSummary: `عدد الطلبات المدرجة: ${c.filteredMaintenanceRows.length} طلب صيانة`,
      },
      documentSettings.settings,
    );
  };

  const actions = (
    <div className="flex gap-2">
      <Button type="button" variant="outline" onClick={handlePrintMaintenanceList} disabled={!documentSettings.isReady} className="min-h-11 gap-2 font-bold">
        <Printer className="size-4 text-primary" aria-hidden="true" />
        طباعة كشف الصيانة A4
      </Button>
      <Button type="button" onClick={c.openCreateForm} className="min-h-11">
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

      <ResponsiveCardGrid desktopColumns={4}>
        {summaryCards.map((card) => (
          <KpiCard
            key={card.key}
            label={card.label}
            value={c.isLoading ? '—' : c.maintenanceSummary[card.key]}
            sub={card.sub}
            icon={card.icon}
            accent={card.accent}
          />
        ))}
      </ResponsiveCardGrid>

      <FilterBar
        filters={(
          <>
            <Select
              aria-label="تصفية حسب الحالة"
              value={String(c.statusFilter)}
              onChange={(event) => c.setStatusFilter(event.target.value as MaintenanceStatusFilter)}
            >
              <option value="all">كل الحالات</option>
              <option value="open">مفتوح</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="resolved">تم الحل</option>
              <option value="closed">مغلق</option>
            </Select>
            <Select
              aria-label="تصفية حسب الأولوية"
              value={String(c.priorityFilter)}
              onChange={(event) => c.setPriorityFilter(event.target.value as MaintenancePriorityFilter)}
            >
              <option value="all">كل الأولويات</option>
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </Select>
            <Select
              aria-label="تصفية حسب العقار"
              value={c.propertyFilterId}
              onChange={(event) => c.setPropertyFilterId(event.target.value)}
            >
              <option value="">كل العقارات</option>
              {c.properties.map((property) => (
                <option key={property.id} value={property.id}>{property.title}</option>
              ))}
            </Select>
          </>
        )}
        actions={c.hasFilters ? (
          <Button type="button" variant="secondary" onClick={clearAllFilters}>
            مسح الفلاتر
          </Button>
        ) : undefined}
      />

      <ActiveFilterBar filters={activeFilters} onClearAll={clearAllFilters} />

      <AsyncContentState
        status={c.isLoading ? 'loading' : c.hasLoadError ? 'error' : c.filteredMaintenanceRows.length === 0 ? 'empty' : 'ready'}
        error={c.loadError}
        errorTitle="تعذر تحميل طلبات الصيانة"
        errorAction={<Button type="button" onClick={c.retryMaintenanceWorkspace}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد طلبات صيانة"
        emptyDescription={c.hasFilters ? 'لا توجد طلبات تطابق الفلاتر الحالية.' : 'أضف طلب صيانة جديد للبدء.'}
      >
        <MaintenanceList
          rows={c.filteredMaintenanceRows}
          properties={c.properties}
          allUnits={c.allUnits}
          actionsPending={c.updateStatusMutation.isPending || c.resolveMutation.isPending}
          onViewDetails={c.setDetailsRequest}
          onEdit={c.openEditForm}
          onStatusAction={c.handleStatusAction}
        />
      </AsyncContentState>

      <MaintenanceRequestForm
        open={c.showForm}
        isEditing={Boolean(c.editingRequest)}
        isEditingResolvedRequest={c.isEditingResolvedRequest}
        isSubmitting={c.createMutation.isPending || c.updateRequestMutation.isPending}
        isLoadingUnits={c.unitsQuery.isLoading}
        form={c.form}
        formPropertyId={c.formPropertyId}
        properties={c.properties}
        units={c.units}
        firstError={c.firstCreateError}
        onOpenChange={c.setShowForm}
        onSubmit={c.onSubmit}
      />

      <MaintenanceDetailsOverlay
        request={c.detailsRequest}
        onOpenChange={(open) => { if (!open) c.setDetailsRequest(null); }}
      />

      <MaintenanceResolveOverlay
        target={c.resolveTarget}
        form={c.resolveForm}
        isSubmitting={c.resolveMutation.isPending}
        firstError={c.firstResolveError}
        onOpenChange={(open) => { if (!open) c.setResolveTarget(null); }}
        onSubmit={c.submitResolve}
      />
    </>
  );

  if (mode === 'embedded') {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="طلبات الصيانة"
        description="تتبع طلبات الصيانة حسب الحالة والأولوية والعقار، مع إجراءات واضحة للموبايل والديسكتوب وطباعة التقرير الشامل."
        primaryAction={actions}
      />
      {body}
    </PageLayout>
  );
}
