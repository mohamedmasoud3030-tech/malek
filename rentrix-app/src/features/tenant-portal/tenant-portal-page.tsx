import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileText, Home, ReceiptText, ShieldCheck, Wrench } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { LoadingState } from '@/components/ui/loading-state';
import { APP_BRAND_NAME } from '@/lib/brand';
import { loadTenantPortalSnapshot } from './tenant-portal-service';
import type { TenantPortalLoadResult } from './tenant-portal-read-model';

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

/**
 * Tenant Portal v1 — a leaf outside the office shell. The URL contains only a
 * revocable bearer token; the server derives tenant/company scope from it.
 * This page contains no office navigation and no mutation controls.
 */
export function TenantPortalPage() {
  const token = useMemo(
    () => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('token'),
    [],
  );
  const [result, setResult] = useState<TenantPortalLoadResult | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    void loadTenantPortalSnapshot(token)
      .then((next) => { if (active) setResult(next); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [token]);

  const snapshot = result?.status === 'ready' ? result.snapshot : null;

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8" contentClassName="space-y-4">
      <div data-tenant-portal className="space-y-4">
        <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card" data-tenant-portal-header>
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-black text-primary">بوابة المستأجر · قراءة فقط</p>
            <h1 className="mt-0.5 text-xl font-black sm:text-2xl">حسابي في {APP_BRAND_NAME}</h1>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-muted-foreground sm:text-sm">
              هذا رابط خاص بحسابك. يعرض بيانات عقدك واستحقاقاتك وإيصالاتك فقط ولا يفتح أي جزء من نظام المكتب.
            </p>
          </div>
        </header>

        {!result && !loadError ? <LoadingState variant="page" label="جارٍ التحقق من الرابط وتحميل بياناتك..." /> : null}

        {loadError ? (
          <section role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5">
            <h2 className="font-black">تعذر تحميل البوابة</h2>
            <p className="mt-1 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد فتح الرابط. لم يتم عرض أي بيانات.</p>
          </section>
        ) : null}

        {result?.status === 'invalid' ? (
          <section role="alert" className="rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5" data-tenant-portal-auth-state="invalid">
            <h2 className="font-black">الرابط غير صالح أو انتهت صلاحيته</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              اطلب من مكتب الإدارة رابطًا جديدًا. لا يمكن الوصول للبوابة برقم مستأجر أو حساب موظف أو رابط منتهي.
            </p>
          </section>
        ) : null}

        {snapshot ? (
          <main className="space-y-4" data-tenant-portal-auth-state="authorized">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-4" /><h2 className="text-sm font-black">الحساب</h2></div>
                <p className="mt-3 font-black">{snapshot.identity.fullName}</p>
                <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{snapshot.identity.phone || snapshot.identity.email || '—'}</p>
              </article>

              <article className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-primary"><Home className="size-4" /><h2 className="text-sm font-black">الوحدة</h2></div>
                <p className="mt-3 font-black">{snapshot.unit?.unitNumber ?? 'لا توجد وحدة حالية'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{snapshot.unit?.title ?? '—'}</p>
              </article>

              <article className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-primary"><FileText className="size-4" /><h2 className="text-sm font-black">العقد</h2></div>
                <p className="mt-3 font-black">{snapshot.contract?.reference ?? 'لا يوجد عقد'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{snapshot.contract ? `${date(snapshot.contract.startDate)} — ${date(snapshot.contract.endDate)}` : '—'}</p>
              </article>

              <article className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-primary"><ReceiptText className="size-4" /><h2 className="text-sm font-black">المتبقي</h2></div>
                <p className="mt-3 font-black">{snapshot.paidPosition ? money(snapshot.paidPosition.remaining, snapshot.paidPosition.currency) : '—'}</p>
                <p className="mt-1 text-xs text-muted-foreground">متأخر: {snapshot.paidPosition ? money(snapshot.paidPosition.overdue, snapshot.paidPosition.currency) : '—'}</p>
              </article>
            </section>

            {snapshot.paidPosition ? (
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <h2 className="font-black">الموقف المالي</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">المستحق</p><p className="mt-1 font-black">{money(snapshot.paidPosition.invoiced)}</p></div>
                  <div><p className="text-xs text-muted-foreground">المدفوع</p><p className="mt-1 font-black">{money(snapshot.paidPosition.paid)}</p></div>
                  <div><p className="text-xs text-muted-foreground">المتبقي</p><p className="mt-1 font-black">{money(snapshot.paidPosition.remaining)}</p></div>
                  <div><p className="text-xs text-muted-foreground">المتأخر</p><p className="mt-1 font-black">{money(snapshot.paidPosition.overdue)}</p></div>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /><h2 className="font-black">جدول الاستحقاق</h2></div>
              {snapshot.dueSchedule.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">لا توجد استحقاقات مسجلة.</p> : (
                <div className="mt-3 divide-y divide-border/70">
                  {snapshot.dueSchedule.map((item, index) => (
                    <div key={`${item.dueDate}-${index}`} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                      <div><p className="font-bold">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{date(item.dueDate)} · {item.status === 'paid' ? 'مدفوع' : item.status === 'overdue' ? 'متأخر' : 'مفتوح'}</p></div>
                      <p className="font-black">{money(item.amount, item.currency)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center gap-2"><ReceiptText className="size-4 text-primary" /><h2 className="font-black">الإيصالات</h2></div>
              {snapshot.receipts.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">لا توجد إيصالات مسجلة.</p> : (
                <div className="mt-3 divide-y divide-border/70">
                  {snapshot.receipts.map((receipt) => (
                    <div key={`${receipt.reference}-${receipt.date}`} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                      <div><p className="font-bold">{receipt.reference}</p><p className="mt-1 text-xs text-muted-foreground">{date(receipt.date)} · {receipt.status === 'void' ? 'ملغي' : 'مثبت'}</p></div>
                      <p className="font-black">{money(receipt.amount, receipt.currency)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-4"><FileText className="size-4 text-primary" /><p className="mt-2 text-sm font-black">المستندات</p><p className="mt-1 text-xs text-muted-foreground">{snapshot.documents.length ? `${snapshot.documents.length} مستند` : 'لا توجد مستندات مرتبطة بالمستأجر بأمان حتى الآن'}</p></div>
              <div className="rounded-2xl border border-border bg-card p-4"><Wrench className="size-4 text-primary" /><p className="mt-2 text-sm font-black">الصيانة</p><p className="mt-1 text-xs text-muted-foreground">{snapshot.maintenance.length ? `${snapshot.maintenance.length} طلب` : 'لا توجد طلبات مرتبطة بالمستأجر بأمان حتى الآن'}</p></div>
              <div className="rounded-2xl border border-border bg-card p-4"><Home className="size-4 text-primary" /><p className="mt-2 text-sm font-black">الخدمات</p><p className="mt-1 text-xs text-muted-foreground">{snapshot.services.length ? `${snapshot.services.length} خدمة` : 'لا توجد خدمات مرتبطة بالمستأجر بأمان حتى الآن'}</p></div>
            </section>
          </main>
        ) : null}
      </div>
    </PageLayout>
  );
}
