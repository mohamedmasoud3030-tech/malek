import { Link, useParams } from '@tanstack/react-router';
import { BarChart3, Edit, FilePlus2 } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnitFormModal } from '@/features/units/unit-form-modal';
import { useUnits } from '@/features/units/use-units';
import { useUnitContractDrafts } from '@/features/contracts/queries/useUnitContractDrafts';
import { useAuth } from '@/hooks/use-auth';
import { formatMoney } from '@/hooks/useCompanyFormatters';
import { PropertyInfoItem } from '../components/property-info-item';
import { useProperty } from '../use-properties';
import { unitStatusLabels } from '@/features/units/unit-schema';

const unitStatusTone = { available: 'success', occupied: 'info', maintenance: 'warning', reserved: 'neutral' } as const;

export function PropertyUnitDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const unitId = typeof params.unitId === 'string' ? params.unitId : '';
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const { canAccess } = useAuth();
  const canViewReports = canAccess('financial.reports.view');
  const [editOpen, setEditOpen] = useState(false);
  const unitDraftsQuery = useUnitContractDrafts({ propertyId, unitIds: unitId ? [unitId] : [] });

  const property = propertyQuery.data;
  const unit = unitsQuery.data?.find((candidate) => candidate.id === unitId);
  const pendingDraft = unitDraftsQuery.data?.[0] ?? null;
  const refreshError = unitsQuery.isError
    ? unitsQuery.error
    : propertyQuery.isError
      ? propertyQuery.error
      : unitDraftsQuery.isError
        ? unitDraftsQuery.error
        : undefined;
  const retry = () => { void Promise.all([unitsQuery.refetch(), propertyQuery.refetch(), unitDraftsQuery.refetch()]); };

  return (
    <AsyncContentState
      status={unit ? 'ready' : unitsQuery.isLoading ? 'loading' : unitsQuery.isError ? 'error' : 'empty'}
      error={unitsQuery.error}
      errorTitle="تعذر تحميل تفاصيل الوحدة"
      errorAction={<Button onClick={retry}>إعادة المحاولة</Button>}
      emptyTitle="الوحدة غير موجودة"
    >
      {unit && (
        <div className="space-y-6">
          {refreshError ? (
            <DataRefreshAlert
              onRetry={retry}
              isRefreshing={unitsQuery.isFetching || propertyQuery.isFetching || unitDraftsQuery.isFetching}
            />
          ) : null}
          <EntityDetailHeader
            title={`وحدة ${unit.unit_number}`}
            subtitle={property ? property.title : undefined}
            backTo={`/properties/${propertyId}/units`}
            backLabel="العودة للوحدات"
            status={
              <span className="flex flex-wrap gap-1.5">
                <StatusBadge tone={unitStatusTone[unit.status as keyof typeof unitStatusTone] ?? 'neutral'}>
                  {unitStatusLabels[unit.status as keyof typeof unitStatusLabels] ?? unit.status}
                </StatusBadge>
                {pendingDraft ? <StatusBadge tone="warning">مسودة عقد قيد الإعداد</StatusBadge> : null}
              </span>
            }
            actions={
              <>
                {canViewReports ? (
                  <Button asChild variant="outline" className="min-h-11">
                    <Link
                      to="/reports"
                      search={{ section: 'analytics', view: 'property_analytics', propertyId, unitId: unit.id } as never}
                    >
                      <BarChart3 className="me-1 size-4" aria-hidden="true" />
                      تحليل الوحدة
                    </Link>
                  </Button>
                ) : null}
                {pendingDraft ? (
                  <Button asChild variant="secondary" className="min-h-11">
                    <Link to="/contracts/$contractId" params={{ contractId: pendingDraft.id }}>
                      <FilePlus2 className="me-1 size-4" aria-hidden="true" />
                      مراجعة المسودة
                    </Link>
                  </Button>
                ) : unit.status === 'available' ? (
                  <Button asChild className="min-h-11">
                    <Link
                      to="/contracts/new"
                      search={{ propertyId, unitId: unit.id }}
                    >
                      <FilePlus2 className="me-1 size-4" aria-hidden="true" />
                      ابدأ التأجير
                    </Link>
                  </Button>
                ) : null}
                <Button variant="secondary" className="min-h-11" onClick={() => setEditOpen(true)}>
                  <Edit className="me-1 size-4" aria-hidden="true" />
                  تعديل الوحدة
                </Button>
              </>
            }
          />

          <div className="grid gap-4 md:grid-cols-2">
            <PropertyInfoItem label="رقم الوحدة" value={`وحدة ${unit.unit_number}`} />
            <PropertyInfoItem label="الدور" value={unit.floor ?? '—'} />
            <PropertyInfoItem label="قيمة الإيجار المسجلة" value={formatMoney(unit.rent_amount)} />
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">العقار التابع له</p>
              <p className="mt-1">
                {property ? (
                  <Link to="/properties/$propertyId" params={{ propertyId: property.id }} className="font-semibold text-primary hover:underline">
                    {property.title}
                  </Link>
                ) : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">ملاحظات الوحدة</p>
              <p className="mt-1 leading-7">{unit.notes ?? '—'}</p>
            </div>
          </div>

          <UnitFormModal propertyId={propertyId} unit={unit} open={editOpen} onOpenChange={setEditOpen} />
        </div>
      )}
    </AsyncContentState>
  );
}
