import { CheckCircle2, ListChecks, TriangleAlert } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { EmptyState } from '@/components/ui/state-surfaces';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import type { DataIntegrityCheck, DataIntegrityResult } from '../types';

export type DataIntegrityViewState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'ready'; result: DataIntegrityResult; refreshError?: unknown }>;

type DataIntegrityViewProps = Readonly<{
  state: DataIntegrityViewState;
  onRetry?: () => void;
  isRefreshing?: boolean;
}>;

export function DataIntegrityView({ state, onRetry, isRefreshing = false }: DataIntegrityViewProps) {
  const companySettings = useCompanySettingsContract();

  const retryAction = onRetry ? (
    <Button variant="secondary" size="sm" loading={isRefreshing} onClick={onRetry}>
      إعادة الفحص
    </Button>
  ) : undefined;

  // The "unavailable" result is a safety-first refusal to guess at data
  // integrity (e.g. an unverified schema), not an ordinary empty list — it
  // keeps the louder role="alert" treatment the generic empty state doesn't
  // use by default.
  if (state.status === 'ready' && state.result.status === 'unavailable') {
    return <EmptyState title="فحص سلامة البيانات غير متاح" description={state.result.reason} role="alert" ariaLive="assertive" action={retryAction} />;
  }

  const checks = state.status === 'ready' && state.result.status === 'available' ? state.result.snapshot.checks : [];
  const status = state.status === 'loading'
    ? ('loading' as const)
    : state.status === 'error'
      ? ('error' as const)
      : checks.length === 0
        ? ('empty' as const)
        : ('ready' as const);

  return (
    <AsyncContentState
      status={status}
      error={state.status === 'error' ? state.error : undefined}
      errorTitle="تعذر تشغيل فحص سلامة البيانات"
      errorFallbackMessage="لم يتم تنفيذ أي تغييرات على البيانات. أعد المحاولة لاحقاً."
      errorAction={retryAction}
      emptyTitle="لا توجد فحوصات مفعلة"
      emptyDescription="لا توجد قواعد سلامة بيانات مدعومة في مخطط التشغيل الحالي. راجع مخطط التشغيل عند إضافة قواعد جديدة."
    >
      {state.status === 'ready' && state.result.status === 'available' ? (
        <DataIntegrityReadyContent
          result={state.result}
          refreshError={state.refreshError}
          onRetry={onRetry}
          isRefreshing={isRefreshing}
          checks={checks}
          companySettings={companySettings}
        />
      ) : null}
    </AsyncContentState>
  );
}

function DataIntegrityReadyContent({
  result,
  refreshError,
  onRetry,
  isRefreshing,
  checks,
  companySettings,
}: Readonly<{
  result: Extract<DataIntegrityResult, { status: 'available' }>;
  refreshError: unknown;
  onRetry?: () => void;
  isRefreshing: boolean;
  checks: readonly DataIntegrityCheck[];
  companySettings: ReturnType<typeof useCompanySettingsContract>;
}>) {
  const issueCount = checks.reduce((total, check) => total + check.count, 0);
  const checkedAt = formatCompanyDateTime(companySettings, result.snapshot.checkedAt);

  return (
    <section className="space-y-4">
      {refreshError ? (
        <DataRefreshAlert
          title="تعذر تحديث الفحص"
          description="النتائج أدناه من آخر فحص مكتمل، وليست تأكيداً للحالة الحالية. تحقق من الاتصال ثم أعد الفحص."
          onRetry={onRetry}
          isRefreshing={isRefreshing}
        />
      ) : null}
      <div className="space-y-2">
        <h2 className="sr-only">تدقيق سلامة البيانات</h2>
        <p className="text-sm leading-6 text-muted-foreground">آخر فحص: {checkedAt}</p>
        <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="ملخص سلامة البيانات">
          <KpiCard
            label="الفحوصات"
            value={checks.length}
            icon={ListChecks}
            accent="sky"
            compact
          />
          <KpiCard
            label="الملاحظات"
            value={issueCount}
            icon={TriangleAlert}
            accent={issueCount === 0 ? 'emerald' : 'amber'}
            compact
          />
          <KpiCard
            label="الحالة"
            value={issueCount === 0 ? 'سليم' : 'يحتاج مراجعة'}
            icon={issueCount === 0 ? CheckCircle2 : TriangleAlert}
            accent={issueCount === 0 ? 'emerald' : 'amber'}
            compact
          />
        </ResponsiveCardGrid>
      </div>

      <ResponsiveCardGrid desktopColumns={2} gap="md" aria-label="نتائج فحوصات سلامة البيانات">
        {checks.map((check) => {
          const Icon = check.count > 0 ? TriangleAlert : CheckCircle2;
          return (
            <Card key={check.id} className={check.count > 0 ? 'border-warning/40 bg-warning/10' : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex min-w-0 items-center gap-2"><Icon className={check.count > 0 ? 'size-5 shrink-0 text-warning' : 'size-5 shrink-0 text-success'} /><span className="break-words">{check.label}</span></span>
                  <span className="rounded-full bg-background px-3 py-1 text-sm font-black tabular-nums">{check.count}</span>
                </CardTitle>
                <CardDescription>{check.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </ResponsiveCardGrid>
    </section>
  );
}
