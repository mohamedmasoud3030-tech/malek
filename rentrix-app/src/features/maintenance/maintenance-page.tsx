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
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import { MaintenanceDetailsOverlay, MaintenanceResolveOverlay } from './components/maintenance-detail-resolve-overlays';
import { MaintenanceList } from './components/maintenance-list';
import { maintenancePriorityLabels, maintenanceStatusLabels } from './components/maintenance-list';
import { MaintenanceRequestForm } from './components/maintenance-request-form';
import type { MaintenancePriorityFilter, MaintenanceStatusFilter } from './maintenance-helpers';
import { useMaintenancePageController } from './useMaintenancePageController';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

const summaryCards = [
  { key: 'total', label: 'إجمالي الطلبات', sub: 'ضمن الفلاتر الحالية', icon: Wrench, accent: 'primary' },
  { key: 'open', label: 'طلبات مفتوحة', sub: 'تحتاج إلى بدء المتابعة', icon: AlertCircle, accent: 'sky' },
  { key: 'inProgress', label: 'قيد التنفيذ', sub: 'طلبات يعمل عليها الفريق', icon: Clock, accent: 'amber' },
  { key: 'urgent', label: 'طلبات عاجلة', sub: 'أولوية فورية', icon: Flame, accent: 'rose' },
] as const;

export function MaintenancePage() {
  const c = useMaintenancePageController();

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

  const handlePrintMaintenanceList = () => {
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'كشف بلاغات وطلبات الصيانة الميدانية',
        reportType: 'Maintenance_Requests_Report',
        periodFrom: new Date().toISOString().slice(0, 10),
        periodTo: new Date().toISOString().slice(0, 10),
        sections: [
          {
            title: 'جدول طلبات الصيانة والتكلفة والأولوية',
            rows: c.filteredMaintenanceRows.map((r) => ({
              label: `${r.title} - (${maintenancePriorityLabels[r.priority as keyof typeof maintenancePriorityLabels] ?? r.priority})`,
              value: `الحالة: ${maintenanceStatusLabels[r.status as keyof typeof maintenanceStatusLabels] ?? r.status} | المسؤول: ${r.assigned_to || r.technician_name || 'غير محدد'} | التكلفة: ${r.cost ? `${r.cost} ر.ع` : '—'}`,
            })),
          },
        ],
        totalSummary: `عدد الطلبات المدرجة: ${c.filteredMaintenanceRows.length} طلب صيانة`,
      },
      defaultSettings,
    );
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="طلبات الصيانة"
        description="تتبع طلبات الصيانة حسب الحالة والأولوية والعقار، مع إجراءات واضحة للموبايل والديسكتوب وطباعة التقرير الشامل."
        primaryAction={(
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handlePrintMaintenanceList} className="min-h-11 gap-2 font-bold">
              <Printer className="size-4 text-primary" aria-hidden="true" />
              طباعة كشف الصيانة A4
            </Button>
            <Button type="button" onClick={c.openCreateForm} className="min-h-11">
              <PlusCircle className="me-2 size-4" aria-hidden="true" />
              طلب صيانة جديد
            </Button>
          </div>
        )}
      />

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
    </PageLayout>
  );
}

export default MaintenancePage;
