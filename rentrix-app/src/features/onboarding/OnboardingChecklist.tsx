import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Circle, ListChecks, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useOwners } from '@/features/owners/useOwners';
import { useOnboarding, type OnboardingProgress } from './useOnboarding';
import type { OnboardingRequirementState } from './onboardingService';

type Step = Readonly<{
  id: string;
  label: string;
  to: string;
  done: boolean;
  optional?: boolean;
  waivable: boolean;
  waived: boolean;
}>;

const ROUTES: Readonly<Record<string, string>> = {
  owner: '/owners',
  property: '/properties/new',
  unit: '/properties',
  contract: '/contracts/new',
  invoice: '/invoices',
};

/**
 * First-run onboarding checklist shown at the top of the dashboard until the
 * core setup steps are completed or individually waived by an admin (with a
 * mandatory reason). Progress is read from existing data sources; completion
 * and waivers are company-scoped, audited facts in Postgres — never per-user
 * localStorage.
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

  const [waiverFor, setWaiverFor] = useState<OnboardingRequirementState | null>(null);
  const [waiverReason, setWaiverReason] = useState('');
  const [waiverEvidence, setWaiverEvidence] = useState('');

  // The requirement catalog is authoritative from Postgres (never hard-coded in
  // the browser); if the server returns none, render a neutral empty state
  // rather than inventing a canonical catalog client-side.
  const requirements = onboarding.requirements;

  const doneByCode = useMemo<Record<string, boolean>>(
    () => ({
      owner: hasOwner,
      property: progress.hasProperty,
      unit: progress.hasUnit,
      contract: progress.hasContract,
      invoice: progress.hasInvoice,
    }),
    [progress.hasProperty, progress.hasUnit, progress.hasContract, progress.hasInvoice, hasOwner],
  );

  const steps = useMemo<Step[]>(
    () =>
      requirements.map((req) => {
        const waived = req.waived;
        const done = waived || Boolean(doneByCode[req.code]);
        return {
          id: req.code,
          label: req.label_ar,
          to: ROUTES[req.code] ?? '/dashboard',
          done,
          optional: !req.required,
          waivable: req.waiver_policy === 'ADMIN_WAIVABLE',
          waived,
        };
      }),
    [requirements, doneByCode],
  );

  const requiredSteps = steps.filter((step) => !step.optional);
  const doneRequired = requiredSteps.filter((step) => step.done).length;
  const allRequiredDone = doneRequired === requiredSteps.length;
  const progressPct = requiredSteps.length === 0 ? 100 : Math.round((doneRequired / requiredSteps.length) * 100);

  const openWaiver = (step: Step) => {
    const requirement = requirements.find((req) => req.code === step.id);
    if (!requirement || !step.waivable) return;
    setWaiverFor(requirement);
    setWaiverReason('');
    setWaiverEvidence('');
  };

  const submitWaiver = () => {
    if (!waiverFor || waiverReason.trim() === '') return;
    onboarding.waive(waiverFor.code, waiverReason, waiverEvidence.trim() || undefined);
    setWaiverFor(null);
  };

  if (!isVisible) return null;
  // No hard-coded fallback catalog: if the backend returned no requirements,
  // render a neutral empty state instead of inventing canonical steps client-side.
  if (requirements.length === 0) {
    return (
      <Card variant="default" className="border-border/60">
        <CardContent className="space-y-2">
          <CardTitle className="text-base">جهّز مكتبك لأول عملية إيجار</CardTitle>
          <p className="text-xs text-muted-foreground">
            خطوات الإعداد غير متاحة حالياً — حاول مرة أخرى لاحقاً.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card variant="default" className="border-primary/20 bg-primary/[0.03]">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ListChecks className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">جهّز مكتبك لأول عملية إيجار</CardTitle>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                ابدأ بالمالك، ثم العقار والوحدة، وبعدها أنشئ مسودة العقد واعتمدها.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="متابعة الإعداد لاحقًا" onClick={onboarding.dismissLater}>
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
                <div className="flex items-center gap-2">
                  <Link
                    to={step.to}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2.5 transition hover:border-primary/40"
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
                      <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                        اختياري
                      </span>
                    ) : null}
                    {!step.optional && !step.done ? (
                      <span className="ms-auto text-xs font-bold text-primary">فتح</span>
                    ) : null}
                  </Link>
                  {!step.done ? (
                    step.waivable ? (
                      <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => openWaiver(step)}>
                        تخطٍّ بموافقة
                      </Button>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
                        <ShieldAlert className="size-3.5" aria-hidden="true" />
                        إلزامي
                      </span>
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-end pt-1">
            <Button size="sm" disabled={!allRequiredDone} onClick={onboarding.complete}>
              <CheckCircle2 className="me-2 size-4" />
              {allRequiredDone ? 'اعتماد اكتمال الإعداد' : 'أكمل الخطوات المطلوبة أولاً'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <EntityForm.Overlay
        open={waiverFor !== null}
        onOpenChange={(next) => {
          if (!next) setWaiverFor(null);
        }}
        title="تخطّي خطوة (يتطلب موافقة مدير)"
        description="يُسجَّل التنازل كسجل مدقق: الشركة، المتطلب، الجهة، الوقت، السبب، والصلاحية."
        className="max-w-xl"
      >
        <EntityForm.Root
          onSubmit={(event) => {
            event.preventDefault();
            submitWaiver();
          }}
        >
          <EntityForm.Field label="الخطوة">
            <Input value={waiverFor?.label_ar ?? ''} readOnly disabled />
          </EntityForm.Field>
          <EntityForm.Field label="سبب التخطي (إلزامي)">
            <Textarea
              value={waiverReason}
              onChange={(event) => setWaiverReason(event.target.value)}
              placeholder="اذكر سبب تخطي هذه الخطوة..."
              required
            />
          </EntityForm.Field>
          <EntityForm.Field label="مرجع الإثبات (اختياري)" description="رابط أو مرجع يوثّق سبب التخطي.">
            <Input
              value={waiverEvidence}
              onChange={(event) => setWaiverEvidence(event.target.value)}
              placeholder="مثال: عقد إدارة خارجي"
              autoComplete="off"
            />
          </EntityForm.Field>
          <EntityForm.Actions
            onCancel={() => setWaiverFor(null)}
            submitDisabled={waiverReason.trim() === ''}
            submitLabel="تأكيد التخطي"
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </>
  );
}
