import type { ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MobileFormStep {
  id: string;
  label: string;
}

/**
 * Mobile-only progressive stepper for genuinely long forms rendered inside the
 * shared responsive Dialog. Desktop (md+) keeps the efficient single-scroll
 * form; these components own the narrow-screen segmented flow: visible step,
 * progress indicator, Back / Next / Submit with safe-area sticky footer.
 *
 * Callers keep all field state mounted (sections are hidden, never unmounted)
 * so nothing is lost when stepping back and forth.
 */

export function MobileFormStepperHeader({
  steps,
  current,
}: Readonly<{ steps: readonly MobileFormStep[]; current: number }>) {
  const step = steps[current];
  const progress = ((current + 1) / steps.length) * 100;
  return (
    <div className="md:hidden" data-mobile-form-stepper-header>
      <div className="rounded-2xl border border-border/70 bg-muted/25 p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
          <span>
            الخطوة {current + 1} من {steps.length}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">{step.label}</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`تقدم النموذج: ${Math.round(progress)}%`}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <ol className="mt-2.5 flex items-center gap-1" aria-label="خطوات النموذج">
          {steps.map((item, index) => {
            const done = index < current;
            const active = index === current;
            return (
              <li key={item.id} className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold',
                    done && 'bg-success/15 text-success',
                    active && 'bg-primary text-primary-foreground',
                    !done && !active && 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3" /> : index + 1}
                </span>
                <span className={cn('h-px flex-1', index < steps.length - 1 && (done || active ? 'bg-primary/40' : 'bg-border'))} aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function MobileFormStepperFooter({
  current,
  steps,
  onBack,
  onNext,
  onCancel,
  isSubmitting,
  submitDisabled = false,
  submitLabel = 'تأكيد',
  backLabel = 'السابق',
  nextLabel = 'التالي',
}: Readonly<{
  current: number;
  steps: readonly MobileFormStep[];
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  backLabel?: string;
  nextLabel?: string;
}>) {
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  return (
    <div
      data-mobile-form-stepper-footer
      className="sticky bottom-[var(--entity-form-action-offset,0px)] z-20 -mx-4 mt-4 grid grid-cols-2 gap-2 border-t border-border/70 bg-background/96 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-12px_30px_hsl(var(--background)/0.92)] backdrop-blur md:hidden"
    >
      <Button type="button" variant="secondary" className="min-h-11" onClick={isFirst ? onCancel : onBack} disabled={isSubmitting}>
        <ChevronRight className="me-1 size-4 rtl:rotate-180" aria-hidden="true" />
        {isFirst ? 'إلغاء' : backLabel}
      </Button>
      {isLast ? (
        <Button type="submit" className="min-h-11" disabled={submitDisabled || isSubmitting}>
          {isSubmitting ? 'جارٍ الحفظ...' : submitLabel}
        </Button>
      ) : (
        <Button type="button" className="min-h-11" onClick={onNext} disabled={isSubmitting}>
          {nextLabel}
          <ChevronLeft className="ms-1 size-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/** Convenience composition: header + content + footer (content is the caller's current step). */
export function MobileFormStepper({
  steps,
  current,
  onBack,
  onNext,
  onCancel,
  isLast,
  isSubmitting,
  submitDisabled = false,
  submitLabel = 'تأكيد',
  children,
}: Readonly<{
  steps: readonly MobileFormStep[];
  current: number;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  isLast: boolean;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  children: ReactNode;
}>) {
  return (
    <div className="md:hidden" data-mobile-form-stepper>
      <MobileFormStepperHeader steps={steps} current={current} />
      <div className="mt-4">{children}</div>
      <MobileFormStepperFooter
        current={current}
        steps={steps}
        onBack={onBack}
        onNext={onNext}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitDisabled={submitDisabled}
        submitLabel={submitLabel}
      />
    </div>
  );
}
