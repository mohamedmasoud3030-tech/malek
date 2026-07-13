import { Link, useParams, Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import { Edit, DoorOpen } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { UnitFormModal } from '@/features/units/unit-form-modal';
import { UnitsList } from '@/features/units/units-list';
import { useUnits } from '@/features/units/use-units';
import { formatMoney, formatNumber, formatDate } from '@/hooks/useCompanyFormatters';
import { propertyStatusLabels } from './property-schema';
import { summarizePropertyUnits } from './property-unit-summary';
import { OwnerAgreementsManager } from '@/features/owners/OwnerAgreementsManager';
import { useProperty } from './use-properties';
import { unitStatusLabels } from '../units/unit-schema';

const propertyStatusTone = { active: 'green', inactive: 'gray', maintenance: 'gold', sold: 'blue' } as const;
const unitStatusTone = { available: 'green', occupied: 'blue', maintenance: 'gold', reserved: 'gray' } as const;

const propertyTypeAliases: Readonly<Record<string, string>> = {
  'building': 'مبنى',
  'Building': 'مبنى',
  'BUILDING': 'مبنى',
};

function translatePropertyType(value: string): string {
  const trimmed = value.trim();
  return propertyTypeAliases[trimmed] ?? trimmed;
}

function InfoItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

/**
 * Shared Property Detail Shell/Layout Route
 */
export function PropertyDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const property = propertyQuery.data;
  const location = useLocation();

  // Determine current active sub-view path
  const isUnitsTab = location.pathname.endsWith('/units') || location.pathname.includes('/units/');

  return (
    <AsyncContentState
      status={propertyQuery.isLoading ? 'loading' : propertyQuery.isError ? 'error' : !property ? 'empty' : 'ready'}
      error={propertyQuery.error}
      errorTitle="تعذر تحميل العقار"
      errorAction={<Button onClick={() => propertyQuery.refetch()}>إعادة المحاولة</Button>}
      emptyTitle="العقار غير موجود"
      emptyDescription="ربما تم حذف العقار أو لا تملك صلاحية الوصول إليه."
    >
      {property && (
        <PageLayout dir="rtl" size="wide">
          <EntityDetailHeader
            title={property.title ?? 'عقار'}
            subtitle={property.address ?? undefined}
            backTo="/properties"
            backLabel="العقارات"
            status={<StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>}
            actions={
              <Button asChild>
                <Link to="/properties/$propertyId/edit" params={{ propertyId }}>
                  <Edit className="me-2 size-4" />تعديل
                </Link>
              </Button>
            }
          />

          {/* Sub-Navigation Tabs */}
          <div className="border-b border-border">
            <div className="flex gap-6">
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${!isUnitsTab ? 'border-primary text-primary font-black' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                نظرة عامة
              </Link>
              <Link
                to="/properties/$propertyId/units"
                params={{ propertyId }}
                className={`border-b-2 pb-3 text-sm font-bold transition-all duration-150 ${isUnitsTab ? 'border-primary text-primary font-black' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                الوحدات
              </Link>
            </div>
          </div>

          {/* Sub-View Render Outlet */}
          <Outlet />
        </PageLayout>
      )}
    </AsyncContentState>
  );
}

/**
 * Property Overview Sub-View
 */
export function PropertyOverview() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);

  const property = propertyQuery.data;

  return (
    <AsyncContentState
      status={propertyQuery.isLoading ? 'loading' : !property ? 'empty' : 'ready'}
      emptyTitle="العقار غير موجود"
    >
      {property && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>معلومات العقار</CardTitle>
              <CardDescription>البيانات الأساسية للعقار مع معلومات المالك وقيم الشراء والتقييم.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveCardGrid desktopColumns={4} gap="lg">
              <InfoItem label="النوع" value={translatePropertyType(property.type)} />
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">الحالة</p>
                <div className="mt-2">
                  <StatusBadge tone={propertyStatusTone[property.status]}>{propertyStatusLabels[property.status]}</StatusBadge>
                </div>
              </div>
              <InfoItem label="اسم المالك للعرض" value={property.owner_name ?? '—'} />
              <InfoItem label="قيمة الشراء" value={formatMoney(property.purchase_value)} />
              <InfoItem label="القيمة الحالية" value={formatMoney(property.current_value)} />
              <InfoItem label="تاريخ الإنشاء" value={formatDate(property.created_at)} />
              <div className="rounded-2xl border border-border bg-background p-4 md:col-span-2">
                <p className="text-xs font-bold text-muted-foreground">ملاحظات</p>
                <p className="mt-1 leading-7">{property.notes ?? '—'}</p>
              </div>
              </ResponsiveCardGrid>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>ملخص الوحدات</CardTitle>
              <CardDescription>مؤشرات قراءة فقط محسوبة من الوحدات المسجلة لهذا العقار.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveCardGrid desktopColumns={6} gap="lg">
              {(() => {
                const unitSummary = summarizePropertyUnits(unitsQuery.data ?? []);
                return (
                  <>
                    <InfoItem label="إجمالي الوحدات" value={formatNumber(unitSummary.totalUnits)} />
                    <InfoItem label="الوحدات المتاحة" value={formatNumber(unitSummary.availableUnits)} />
                    <InfoItem label="الوحدات المشغولة" value={formatNumber(unitSummary.occupiedUnits)} />
                    <InfoItem label="وحدات الصيانة" value={formatNumber(unitSummary.maintenanceUnits)} />
                    <InfoItem label="الوحدات المحجوزة" value={formatNumber(unitSummary.reservedUnits)} />
                    <InfoItem label="إجمالي الإيجار المتوقع" value={formatMoney(unitSummary.expectedRentTotal)} />
                  </>
                );
              })()}
              </ResponsiveCardGrid>
            </CardContent>
          </Card>

          <OwnerAgreementsManager propertyId={propertyId} />

          <Card className="rounded-2xl border-dashed border-2 bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground">الحسابات والوضع المالي</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
              سيظهر الملخص المالي هنا عند توفر بيانات مالية مرتبطة بالعقار.
            </CardContent>
          </Card>
        </div>
      )}
    </AsyncContentState>
  );
}

/**
 * Property Units List Tab Sub-View
 */
export function PropertyUnitsPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const unitsQuery = useUnits(propertyId);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <UnitsList propertyId={propertyId} unitsQuery={unitsQuery} />
    </div>
  );
}

/**
 * Property Unit Detail Sub-View
 */
export function PropertyUnitDetailPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : '';
  const unitId = typeof params.unitId === 'string' ? params.unitId : '';
  
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const property = propertyQuery.data;
  const unit = unitsQuery.data?.find((u) => u.id === unitId);

  return (
    <AsyncContentState
      status={unitsQuery.isLoading ? 'loading' : unitsQuery.isError ? 'error' : !unit ? 'empty' : 'ready'}
      error={unitsQuery.error}
      errorTitle="تعذر تحميل تفاصيل الوحدة"
      emptyTitle="الوحدة غير موجودة"
    >
      {unit && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">تفاصيل وحدة {unit.unit_number}</CardTitle>
                <CardDescription>البيانات والمواصفات الفنية للوحدة التابعة للعقار الحالي.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="min-h-10" onClick={() => setEditOpen(true)}>
                  <Edit className="me-1 size-4" aria-hidden="true" />
                  تعديل الوحدة
                </Button>
                <Button variant="ghost" className="min-h-10" onClick={() => navigate({ to: '/properties/$propertyId/units', params: { propertyId } })}>
                  العودة للقائمة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoItem label="رقم الوحدة" value={`وحدة ${unit.unit_number}`} />
              <InfoItem label="الدور" value={unit.floor ?? '—'} />
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-xs font-bold text-muted-foreground">الحالة التشغيلية</p>
                <div className="mt-2">
                  <StatusBadge tone={unitStatusTone[unit.status as keyof typeof unitStatusTone] ?? 'gray'}>
                    {unitStatusLabels[unit.status as keyof typeof unitStatusLabels] ?? unit.status}
                  </StatusBadge>
                </div>
              </div>
              <InfoItem label="قيمة الإيجار المسجلة" value={formatMoney(unit.rent_amount)} />
              <div className="rounded-2xl border border-border bg-background p-4 md:col-span-2">
                <p className="text-xs font-bold text-muted-foreground">العقار التابع له</p>
                <p className="mt-1">
                  {property ? (
                    <Link to="/properties/$propertyId" params={{ propertyId: property.id }} className="text-primary font-black hover:underline">
                      {property.title}
                    </Link>
                  ) : '—'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4 md:col-span-2">
                <p className="text-xs font-bold text-muted-foreground">ملاحظات الوحدة</p>
                <p className="mt-1 leading-7">{unit.notes ?? '—'}</p>
              </div>
            </CardContent>
          </Card>

          <UnitFormModal propertyId={propertyId} unit={unit} open={editOpen} onOpenChange={setEditOpen} />
        </div>
      )}
    </AsyncContentState>
  );
}
