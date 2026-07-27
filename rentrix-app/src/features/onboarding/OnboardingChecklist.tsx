import { useEffect, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Circle, ListChecks, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOwners } from '@/features/owners/useOwners';
import { useOnboarding, type OnboardingProgress } from './useOnboarding';

type Step = Readonly<{
  id: string;
  label: string;
  to: string;
  done: boolean;
  optional?: boolean;
}>;

/**
 * First-run onboarding checklist shown at the top of the dashboard until the
 * core setup steps are completed (or the user skips/dismisses). Progress is read
 * from existing data sources — no new queries or migrations are introduced.
 */
export function OnboardingChecklist({
  progress,
  canManageSetup,
}: Readonly<{
  progress: OnboardingProgress;
  canManageSetup: boolean;
}>) {
  const onboarding = useOnboarding();
  const isVisible = onboarding.isVisible && canManageSetup;
  // #1168: never fetch the owners list when the checklist is hidden/completed —
  // an unnecessary dashboard query for every legacy account.
  const { data: owners } = useOwners({ enabled: isVisible });
  const hasOwner = (owners?.length ?? 0) > 0;

  const steps = useMemo<Step[]>(
    () => [
      { id: 'owner', label: 'إضافة أول مالك', to: '/owners', done: hasOwner },
      { id: 'property', label: 'إنشاء أول عقار', to: '/properties/new', done: progress.hasProperty },
      { id: 'unit', label: 'إنشاء أول وحدة', to: '/properties', done: progress.hasUnit },
      { id: 'contract', label: 'إنشاء أول عقد', to: '/contracts/new', done: progress.hasContract },
      {
        id: 'invoice',
        label: 'إصدار أول فاتورة (اختياري)',
        to: '/invoices',
        done: progress.hasInvoice,
        optional: true,
      },
    ],
    [progress.hasProperty, progress.hasUnit, progress.hasContract, progress.hasInvoice, hasOwner],
  );

  const requiredSteps = steps.filter((step) => !step.optional);
  const doneRequired = requiredSteps.filter((step) => step.done).length;
  const allRequiredDone = doneRequired === requiredSteps.length;
  const progressPct = Math.round((doneRequired / requiredSteps.length) * 100);

  // Auto-complete: once every required step is done the checklist should
  // disappear permanently instead of lingering until a manual dismissal.
  const { complete } = onboarding;
  useEffect(() => {
    if (isVisible && allRequiredDone) complete();
  }, [allRequiredDone, complete, isVisible]);

  if (!isVisible) return null;

  return (
    <Card variant="default" className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ListChecks className="size-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">إعداد حسابك</CardTitle>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              اتبع الترتيب التشغيلي الصحيح: المالك ثم العقار والوحدة والعقد.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="إكمال الإعداد لاحقًا" onClick={onboarding.dismissLater}>
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>التقدّم</span>
            <span>
              {doneRequired} من {requiredSteps.length} خطوات أساسية
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.id}>
              <Link
                to={step.to}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 transition hover:border-primary/40"
              >
                {step.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span
                  className={
                    step.done
                      ? 'text-sm font-bold text-muted-foreground line-through'
                      : 'text-sm font-bold'
                  }
                >
                  {step.label}
                </span>
                {step.optional ? (
                  <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    اختياري
                  </span>
                ) : null}
                {!step.optional && !step.done ? (
                  <span className="ms-auto text-xs font-bold text-primary">فتح</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex justify-end pt-1">
          {allRequiredDone ? (
            <Button size="sm" onClick={onboarding.complete}>
              <CheckCircle2 className="me-2 size-4" />
              تم، إنهاء
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onboarding.skip}>
              تخطّي الإعداد
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
