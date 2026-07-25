import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/empty-state';
import { RouteLoadingState } from '@/components/loading-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import type { DataIntegrityResult } from '../types';

export type DataIntegrityViewState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'ready'; result: DataIntegrityResult }>;

export function DataIntegrityView({ state }: Readonly<{ state: DataIntegrityViewState }>) {
  const companySettings = useCompanySettingsContract();

  if (state.status === 'loading') return <RouteLoadingState />;

  if (state.status === 'error') {
    return <DataErrorScreen title="تعذر تشغيل فحص سلامة البيانات" fallbackMessage="لم يتم تنفيذ أي تغييرات على البيانات. أعد المحاولة لاحقاً." error={state.error} />;
  }

  if (state.result.status === 'unavailable') {
    return <EmptyState title="فحص سلامة البيانات غير متاح" description={state.result.reason} role="alert" ariaLive="assertive" />;
  }

  if (state.result.snapshot.checks.length === 0) {
    return <EmptyState title="لا توجد فحوصات مفعلة" description="لا توجد قواعد سلامة بيانات مدعومة في مخطط التشغيل الحالي." />;
  }

  const issueCount = state.result.snapshot.checks.reduce((total, check) => total + check.count, 0);
  const checkedAt = formatCompanyDateTime(companySettings, state.result.snapshot.checkedAt);

  return (
    <section className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <h2 className="sr-only">تدقيق سلامة البيانات</h2>
          <p className="text-sm leading-6 text-muted-foreground">آخر فحص: {checkedAt}</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold text-muted-foreground">الفحوصات</p>
              <p className="text-2xl font-black">{state.result.snapshot.checks.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold text-muted-foreground">الملاحظات</p>
              <p className="text-2xl font-black">{issueCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-bold text-muted-foreground">الحالة</p>
              <p className="text-2xl font-black">{issueCount === 0 ? 'سليم' : 'يحتاج مراجعة'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {state.result.snapshot.checks.map((check) => {
          const Icon = check.count > 0 ? TriangleAlert : CheckCircle2;
          return (
            <Card key={check.id} className={check.count > 0 ? 'border-warning/40 bg-warning/10' : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex items-center gap-2"><Icon className={check.count > 0 ? 'size-5 text-warning' : 'size-5 text-success'} />{check.label}</span>
                  <span className="rounded-full bg-background px-3 py-1 text-sm font-black">{check.count}</span>
                </CardTitle>
                <CardDescription>{check.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

