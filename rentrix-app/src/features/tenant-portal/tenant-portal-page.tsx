import { useEffect, useState } from 'react';
import { Building2, CalendarClock, FileText, Home, ReceiptText, ShieldCheck, Wrench } from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME } from '@/lib/brand';
import { resolveTenantPortalAuthorization } from './tenant-portal-authority';
import { loadTenantPortalSnapshot } from './tenant-portal-service';
import { TENANT_PORTAL_V1_SECTIONS } from './tenant-portal-read-model';

const sectionMeta = [
  { id: 'identity', label: 'الحساب والهوية', icon: ShieldCheck },
  { id: 'unit_contract', label: 'الوحدة والعقد', icon: Home },
  { id: 'due_schedule', label: 'جدول الاستحقاق', icon: CalendarClock },
  { id: 'position', label: 'المدفوع والمتبقي', icon: ReceiptText },
  { id: 'services', label: 'الخدمات والمرافق', icon: Building2 },
  { id: 'receipts', label: 'الإيصالات والمستندات', icon: ReceiptText },
  { id: 'documents', label: 'المستندات', icon: FileText },
  { id: 'maintenance', label: 'الصيانة', icon: Wrench },
] as const;

/**
 * Tenant Portal v1 — separate constrained read-only surface.
 *
 * This shell deliberately renders NO office navigation, NO edit controls and
 * NO data. It resolves portal authorization (fail closed) and, when the
 * upstream tenant read model becomes available, renders only the scoped
 * projections defined in `tenant-portal-read-model.ts`.
 */
export function TenantPortalPage() {
  const { session, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [loadResult, setLoadResult] = useState<Awaited<ReturnType<typeof loadTenantPortalSnapshot>> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadTenantPortalSnapshot().then(setLoadResult);
  }, [isAuthenticated]);

  const authorization = resolveTenantPortalAuthorization(Boolean(session), undefined);

  const showDeferredCard =
    isAuthenticated &&
    !authorization.authorized &&
    authorization.reason === 'TENANT_AUTHORIZATION_UNAVAILABLE' &&
    loadResult?.status === 'deferred';

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8" contentClassName="space-y-4">
      <div data-tenant-portal className="space-y-4">
      <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card" data-tenant-portal-header>
        <div className="p-4 sm:p-5">
          <p className="text-[11px] font-black text-primary">بوابة المستأجر — نسخة قراءة فقط</p>
          <h1 className="mt-0.5 text-xl font-black sm:text-2xl">حسابي في {APP_BRAND_NAME}</h1>
          <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-muted-foreground sm:text-sm">
            تعرض البوابة فقط بيانات المستأجر المصرّح له: الوحدة والعقد وجدول الاستحقاق والمدفوع
            والمتبقي والخدمات والإيصالات والمستندات والصيانة. لا تتضمن أدوات المكتب أو أي إمكانية تعديل.
          </p>
        </div>
      </header>

      {!isAuthenticated && !isAuthLoading ? (
        <section role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5" data-tenant-portal-auth-state="signed-out">
          <h2 className="text-base font-black">تسجيل الدخول مطلوب</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            سجّل الدخول بحساب المستأجر المرتبط بالعقار لعرض بياناتك. لا يمكن عرض أي بيانات قبل تأكيد
            هوية المستأجر وربطه بالعقار.
          </p>
        </section>
      ) : null}

      {isAuthenticated && authorization.authorized === false ? (
        <section role="status" className="space-y-4" data-tenant-portal-auth-state="deferred">
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:p-5">
            <h2 className="text-base font-black text-warning-foreground">البوابة قيد التفعيل</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              نموذج القراءة المعتمد لتأكيد ربط حساب المستأجر بالعقار قيد التجهيز في النظام. لن تظهر أي
              بيانات قبل اكتمال الربط، ولن تُعرض بيانات مستأجر آخر أو شركة أخرى.
            </p>
            {showDeferredCard ? null : (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {authorization.reason === 'NO_SESSION'
                  ? 'أعد تسجيل الدخول ثم أعد فتح البوابة.'
                  : 'تواصل مع مكتب الإدارة لتأكيد ربط الحساب.'}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-tenant-portal-sections>
            {TENANT_PORTAL_V1_SECTIONS.map((sectionId) => {
              const meta = sectionMeta.find((entry) => entry.id === sectionId);
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <div key={sectionId} className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm" data-tenant-portal-section={sectionId}>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                    <p className="text-xs font-bold">{meta.label}</p>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">تظهر هنا بعد تفعيل الربط</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {isAuthenticated && authorization.authorized ? (
        <section className="rounded-2xl border border-success/25 bg-success/5 p-4 sm:p-5" data-tenant-portal-auth-state="authorized">
          <p className="text-sm font-bold text-success">تم تأكيد هوية المستأجر — عرض القراءة فقط</p>
        </section>
      ) : null}
      </div>
    </PageLayout>
  );
}
