import { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Landmark, ShieldCheck, Wrench } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { APP_BRAND_NAME } from '@/lib/brand';
import { DEFAULT_CURRENCY, formatMoney, normalizeCurrency } from '@/lib/formatters';
import { loadOwnerPortalSnapshot } from './owner-portal-service';
import { ownerPortalWindowNote } from './owner-portal-read-model';
import type {
  OwnerPortalLoadResult,
  OwnerPortalProperty,
  OwnerPortalSettlement,
  OwnerPortalUnit,
} from './owner-portal-read-model';

function money(value: number, currency: string = DEFAULT_CURRENCY) {
  return formatMoney({ amount: value, currency: normalizeCurrency(currency), locale: 'ar-OM-u-nu-latn' });
}

function date(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ar-OM-u-nu-latn', { dateStyle: 'medium' }).format(parsed);
}

function percentage(value: number) {
  return new Intl.NumberFormat('ar-OM-u-nu-latn', { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

/** Honest disclosure when the bounded projection truncated a list window. */
function WindowNote({ text }: Readonly<{ text: string | null }>) {
  if (!text) return null;
  return <p className="border-t border-border/60 p-4 text-xs font-semibold text-muted-foreground">{text}</p>;
}

const propertyColumns: ColumnDef<OwnerPortalProperty>[] = [
  {
    key: 'property',
    header: 'العقار',
    priority: 'identity',
    render: (property) => (
      <div className="min-w-0">
        <p className="font-bold">{property.title}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{property.address || '—'}</p>
      </div>
    ),
  },
  {
    key: 'ownership',
    header: 'الملكية',
    priority: 'primary',
    render: (property) => `${percentage(property.ownershipPercentage)}%`,
  },
  { key: 'units', header: 'الوحدات', priority: 'secondary', render: (property) => property.units },
  { key: 'occupied', header: 'مشغولة', priority: 'secondary', render: (property) => property.occupiedUnits },
  { key: 'vacant', header: 'شاغرة', priority: 'secondary', render: (property) => property.vacantUnits },
];

const unitColumns: ColumnDef<OwnerPortalUnit>[] = [
  { key: 'unit', header: 'الوحدة', priority: 'identity', render: (unit) => <span className="font-bold">{unit.unitNumber}</span> },
  { key: 'property', header: 'العقار', priority: 'secondary', render: (unit) => unit.propertyTitle },
  { key: 'status', header: 'الحالة', priority: 'primary', render: (unit) => unit.occupied ? 'مشغولة' : 'شاغرة' },
  { key: 'rent', header: 'الإيجار المرجعي', priority: 'secondary', render: (unit) => money(unit.referenceRent, unit.currency) },
  { key: 'contractEnd', header: 'نهاية العقد الحالي', priority: 'detail', render: (unit) => date(unit.contractEnd) },
];

const settlementColumns: ColumnDef<OwnerPortalSettlement>[] = [
  {
    key: 'settlement',
    header: 'الكشف',
    priority: 'identity',
    render: (settlement) => (
      <div className="min-w-0">
        <p className="font-bold">{settlement.number}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{settlement.propertyTitle || date(settlement.date)}</p>
      </div>
    ),
  },
  {
    key: 'period',
    header: 'الفترة',
    priority: 'secondary',
    render: (settlement) => `${date(settlement.periodStart)} — ${date(settlement.periodEnd)}`,
  },
  { key: 'status', header: 'الحالة', priority: 'primary', render: (settlement) => settlement.status },
  { key: 'gross', header: 'التحصيل', priority: 'detail', render: (settlement) => money(settlement.grossCollected, settlement.currency) },
  { key: 'fee', header: 'أتعاب المكتب', priority: 'detail', render: (settlement) => money(settlement.officeFee, settlement.currency) },
  { key: 'expenses', header: 'مصروفات المالك', priority: 'detail', render: (settlement) => money(settlement.ownerExpenses, settlement.currency) },
  { key: 'net', header: 'الصافي', priority: 'secondary', render: (settlement) => <span className="font-black">{money(settlement.netPayable, settlement.currency)}</span> },
];

/**
 * Owner Portal — isolated read-only surface outside the office shell.
 * No office navigation or mutation controls are rendered here.
 */
export function OwnerPortalPage() {
  const token = useMemo(
    () => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('token'),
    [],
  );
  const [result, setResult] = useState<OwnerPortalLoadResult | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    void loadOwnerPortalSnapshot(token)
      .then((next) => { if (active) setResult(next); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [token]);

  const snapshot = result?.status === 'ready' ? result.snapshot : null;

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" contentClassName="min-w-0 space-y-4">
      <div data-owner-portal data-owner-portal-mode="read-only" className="space-y-4">
        <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-black text-primary">بوابة مالك العقار · قراءة فقط</p>
            <h1 className="mt-0.5 text-xl font-black sm:text-2xl">أملاكي في {APP_BRAND_NAME}</h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-muted-foreground sm:text-sm">
              رابط عرض خاص يعرض أملاكك وتشغيلها وتسوياتك فقط. لا يفتح قوائم المكتب ولا يسمح بإنشاء أو تعديل أو اعتماد أي حركة.
            </p>
          </div>
        </header>

        {!result && !loadError ? <LoadingState variant="page" label="جارٍ التحقق من الرابط وتحميل بيانات المالك..." /> : null}

        {loadError ? (
          <section role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
            <h2 className="font-black">تعذر تحميل البوابة</h2>
            <p className="mt-1 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد فتح الرابط. لم يتم عرض أي بيانات.</p>
          </section>
        ) : null}

        {result?.status === 'invalid' ? (
          <section role="alert" className="rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5" data-owner-portal-auth-state="invalid">
            <h2 className="font-black">الرابط غير صالح أو انتهت صلاحيته</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              اطلب من مكتب الإدارة رابط عرض جديدًا. لا يمكن الدخول برقم مالك أو حساب موظف أو رابط منتهي.
            </p>
          </section>
        ) : null}

        {snapshot ? (
          <main className="space-y-4" data-owner-portal-auth-state="authorized">
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldCheck className="size-4" />
                    <h2 className="text-sm font-black">المالك</h2>
                  </div>
                  <p className="mt-2 text-lg font-black">{snapshot.identity.fullName}</p>
                  <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                    {snapshot.identity.phone || snapshot.identity.email || '—'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">آخر تحديث: {date(snapshot.asOf)}</p>
              </div>
              <ResponsiveCardGrid desktopColumns={4} gap="sm" className="mt-4">
                <div><p className="text-xs text-muted-foreground">العقارات</p><p className="mt-1 text-xl font-black">{snapshot.summary.properties}</p></div>
                <div><p className="text-xs text-muted-foreground">الوحدات</p><p className="mt-1 text-xl font-black">{snapshot.summary.units}</p></div>
                <div><p className="text-xs text-muted-foreground">الإشغال</p><p className="mt-1 text-xl font-black">{percentage(snapshot.summary.occupancyRate)}%</p><p className="text-[11px] text-muted-foreground">{snapshot.summary.occupiedUnits} مشغولة · {snapshot.summary.vacantUnits} شاغرة</p></div>
                <div><p className="text-xs text-muted-foreground">صافي المستحق</p><p className="mt-1 text-xl font-black">{money(snapshot.summary.netPayable, snapshot.summary.currency)}</p></div>
              </ResponsiveCardGrid>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border/70 p-4 sm:p-5">
                <Building2 className="size-4 text-primary" />
                <div><h2 className="font-black">العقارات والوحدات</h2><p className="text-xs text-muted-foreground">التشغيل فقط — بدون بيانات ملاك أو مستأجرين آخرين.</p></div>
              </div>
              <div className="space-y-4 p-3 sm:p-4">
                <EntityTable
                  aria-label="عقارات المالك"
                  rows={[...snapshot.properties]}
                  columns={propertyColumns}
                  keyOf={(property) => property.id}
                  mobilePrimaryMetaKeys={['ownership', 'units']}
                  emptyTitle="لا توجد عقارات مرتبطة بهذا المالك"
                  emptyDescription="سيظهر هنا أي عقار مرتبط بهذا الرابط عند توفره."
                />
                {ownerPortalWindowNote(snapshot.properties.length, snapshot.propertiesTotal) ? (
                  <p className="text-xs font-semibold text-muted-foreground">{ownerPortalWindowNote(snapshot.properties.length, snapshot.propertiesTotal)}</p>
                ) : null}
                {snapshot.units.length ? (
                  <>
                    <EntityTable
                      aria-label="وحدات المالك"
                      rows={[...snapshot.units]}
                      columns={unitColumns}
                      keyOf={(unit) => unit.id}
                      mobileBadgeKey="status"
                      mobilePrimaryMetaKeys={['property', 'rent']}
                    />
                    {ownerPortalWindowNote(snapshot.units.length, snapshot.unitsTotal) ? (
                      <p className="text-xs font-semibold text-muted-foreground">{ownerPortalWindowNote(snapshot.units.length, snapshot.unitsTotal)}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border/70 p-4 sm:p-5">
                <Landmark className="size-4 text-primary" />
                <div><h2 className="font-black">التحصيل والتسويات</h2><p className="text-xs text-muted-foreground">أرقام المالك المثبتة في تسوياته فقط.</p></div>
              </div>
              <ResponsiveCardGrid desktopColumns={3} gap="sm" className="border-b border-border/70 p-4">
                <div><p className="text-xs text-muted-foreground">التحصيل المرتبط</p><p className="mt-1 font-black">{money(snapshot.summary.grossCollected)}</p></div>
                <div><p className="text-xs text-muted-foreground">مصروفات على المالك</p><p className="mt-1 font-black">{money(snapshot.summary.ownerExpenses)}</p></div>
                <div><p className="text-xs text-muted-foreground">صافي المستحق</p><p className="mt-1 font-black">{money(snapshot.summary.netPayable)}</p></div>
              </ResponsiveCardGrid>
              <div className="p-3 sm:p-4">
                <EntityTable
                  aria-label="تسويات المالك"
                  rows={[...snapshot.settlements]}
                  columns={settlementColumns}
                  keyOf={(settlement) => settlement.id}
                  mobileBadgeKey="status"
                  mobilePrimaryMetaKeys={['period', 'net']}
                  emptyTitle="لا توجد تسويات مسجلة"
                  emptyDescription="ستظهر التسويات الخاصة بهذا المالك هنا عند تسجيلها."
                />
                {ownerPortalWindowNote(snapshot.settlements.length, snapshot.settlementsTotal) ? (
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">{ownerPortalWindowNote(snapshot.settlements.length, snapshot.settlementsTotal)}</p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border/70 p-4"><Wrench className="size-4 text-primary" /><h2 className="font-black">الصيانة</h2></div>
                {snapshot.maintenance.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا توجد طلبات صيانة مرتبطة بالأملاك.</p> : (
                  <div className="divide-y divide-border/70">{snapshot.maintenance.map((item) => <div key={item.id} className="p-4 text-sm"><div className="flex justify-between gap-3"><p className="font-bold">{item.title}</p><span className="text-xs text-muted-foreground">{item.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.propertyTitle}{item.unitNumber ? ` · وحدة ${item.unitNumber}` : ''} · {date(item.createdAt)}</p></div>)}</div>
                )}
                <WindowNote text={ownerPortalWindowNote(snapshot.maintenance.length, snapshot.maintenanceTotal)} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border/70 p-4"><FileText className="size-4 text-primary" /><h2 className="font-black">المستندات</h2></div>
                {snapshot.documents.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا توجد مستندات متاحة للعرض في هذا الرابط.</p> : (
                  <div className="divide-y divide-border/70">{snapshot.documents.map((item) => <div key={item.id} className="p-4 text-sm"><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.scope === 'owner' ? 'ملف المالك' : item.scope === 'property' ? 'العقار' : 'التسوية'} · {date(item.createdAt)}</p></div>)}</div>
                )}
                <WindowNote text={ownerPortalWindowNote(snapshot.documents.length, snapshot.documentsTotal)} />
              </div>
            </section>
          </main>
        ) : null}
      </div>
    </PageLayout>
  );
}