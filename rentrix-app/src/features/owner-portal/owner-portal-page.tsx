import { useEffect, useMemo, useState } from 'react';
import { Building2, FileText, Landmark, ShieldCheck, Wrench } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingState } from '@/components/ui/loading-state';
import { APP_BRAND_NAME } from '@/lib/brand';
import { loadOwnerPortalSnapshot } from './owner-portal-service';
import type { OwnerPortalLoadResult } from './owner-portal-read-model';

function money(value: number, currency = 'OMR') {
  return new Intl.NumberFormat('ar-OM-u-nu-latn', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(Number(value) || 0);
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
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8" contentClassName="space-y-4">
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
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">العقارات</p><p className="mt-1 text-xl font-black">{snapshot.summary.properties}</p></div>
                <div><p className="text-xs text-muted-foreground">الوحدات</p><p className="mt-1 text-xl font-black">{snapshot.summary.units}</p></div>
                <div><p className="text-xs text-muted-foreground">الإشغال</p><p className="mt-1 text-xl font-black">{percentage(snapshot.summary.occupancyRate)}%</p><p className="text-[11px] text-muted-foreground">{snapshot.summary.occupiedUnits} مشغولة · {snapshot.summary.vacantUnits} شاغرة</p></div>
                <div><p className="text-xs text-muted-foreground">صافي المستحق</p><p className="mt-1 text-xl font-black">{money(snapshot.summary.netPayable, snapshot.summary.currency)}</p></div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border/70 p-4 sm:p-5">
                <Building2 className="size-4 text-primary" />
                <div><h2 className="font-black">العقارات والوحدات</h2><p className="text-xs text-muted-foreground">التشغيل فقط — بدون بيانات ملاك أو مستأجرين آخرين.</p></div>
              </div>
              {snapshot.properties.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا توجد عقارات مرتبطة بهذا المالك.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-start">العقار</th><th className="px-4 py-3 text-start">الملكية</th><th className="px-4 py-3 text-start">الوحدات</th><th className="px-4 py-3 text-start">مشغولة</th><th className="px-4 py-3 text-start">شاغرة</th></tr></thead>
                    <tbody className="divide-y divide-border/70">
                      {snapshot.properties.map((property) => <tr key={property.id}><td className="px-4 py-3"><p className="font-bold">{property.title}</p><p className="text-xs text-muted-foreground">{property.address || '—'}</p></td><td className="px-4 py-3">{percentage(property.ownershipPercentage)}%</td><td className="px-4 py-3">{property.units}</td><td className="px-4 py-3">{property.occupiedUnits}</td><td className="px-4 py-3">{property.vacantUnits}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              {snapshot.units.length ? (
                <div className="border-t border-border/70 overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-muted/20 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-start">الوحدة</th><th className="px-4 py-3 text-start">العقار</th><th className="px-4 py-3 text-start">الحالة</th><th className="px-4 py-3 text-start">الإيجار المرجعي</th><th className="px-4 py-3 text-start">نهاية العقد الحالي</th></tr></thead>
                    <tbody className="divide-y divide-border/70">
                      {snapshot.units.map((unit) => <tr key={unit.id}><td className="px-4 py-3 font-bold">{unit.unitNumber}</td><td className="px-4 py-3">{unit.propertyTitle}</td><td className="px-4 py-3">{unit.occupied ? 'مشغولة' : 'شاغرة'}</td><td className="px-4 py-3">{money(unit.referenceRent, unit.currency)}</td><td className="px-4 py-3">{date(unit.contractEnd)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border/70 p-4 sm:p-5">
                <Landmark className="size-4 text-primary" />
                <div><h2 className="font-black">التحصيل والتسويات</h2><p className="text-xs text-muted-foreground">أرقام المالك المثبتة في تسوياته فقط.</p></div>
              </div>
              <div className="grid grid-cols-3 gap-3 border-b border-border/70 p-4">
                <div><p className="text-xs text-muted-foreground">التحصيل المرتبط</p><p className="mt-1 font-black">{money(snapshot.summary.grossCollected)}</p></div>
                <div><p className="text-xs text-muted-foreground">مصروفات على المالك</p><p className="mt-1 font-black">{money(snapshot.summary.ownerExpenses)}</p></div>
                <div><p className="text-xs text-muted-foreground">صافي المستحق</p><p className="mt-1 font-black">{money(snapshot.summary.netPayable)}</p></div>
              </div>
              {snapshot.settlements.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا توجد تسويات مسجلة.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-start">الكشف</th><th className="px-4 py-3 text-start">الفترة</th><th className="px-4 py-3 text-start">الحالة</th><th className="px-4 py-3 text-start">التحصيل</th><th className="px-4 py-3 text-start">أتعاب المكتب</th><th className="px-4 py-3 text-start">مصروفات المالك</th><th className="px-4 py-3 text-start">الصافي</th></tr></thead>
                    <tbody className="divide-y divide-border/70">
                      {snapshot.settlements.map((settlement) => <tr key={settlement.id}><td className="px-4 py-3"><p className="font-bold">{settlement.number}</p><p className="text-xs text-muted-foreground">{settlement.propertyTitle || date(settlement.date)}</p></td><td className="px-4 py-3">{date(settlement.periodStart)} — {date(settlement.periodEnd)}</td><td className="px-4 py-3">{settlement.status}</td><td className="px-4 py-3">{money(settlement.grossCollected)}</td><td className="px-4 py-3">{money(settlement.officeFee)}</td><td className="px-4 py-3">{money(settlement.ownerExpenses)}</td><td className="px-4 py-3 font-black">{money(settlement.netPayable)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border/70 p-4"><Wrench className="size-4 text-primary" /><h2 className="font-black">الصيانة</h2></div>
                {snapshot.maintenance.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا توجد طلبات صيانة مرتبطة بالأملاك.</p> : (
                  <div className="divide-y divide-border/70">{snapshot.maintenance.map((item) => <div key={item.id} className="p-4 text-sm"><div className="flex justify-between gap-3"><p className="font-bold">{item.title}</p><span className="text-xs text-muted-foreground">{item.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.propertyTitle}{item.unitNumber ? ` · وحدة ${item.unitNumber}` : ''} · {date(item.createdAt)}</p></div>)}</div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border/70 p-4"><FileText className="size-4 text-primary" /><h2 className="font-black">المستندات</h2></div>
                {snapshot.documents.length === 0 ? <p className="p-4 text-sm text-muted-foreground">لا توجد مستندات متاحة للعرض في هذا الرابط.</p> : (
                  <div className="divide-y divide-border/70">{snapshot.documents.map((item) => <div key={item.id} className="p-4 text-sm"><p className="font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.scope === 'owner' ? 'ملف المالك' : item.scope === 'property' ? 'العقار' : 'التسوية'} · {date(item.createdAt)}</p></div>)}</div>
                )}
              </div>
            </section>
          </main>
        ) : null}
      </div>
    </PageLayout>
  );
}
