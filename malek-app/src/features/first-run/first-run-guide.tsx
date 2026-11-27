import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, CircleArrowLeft, X } from 'lucide-react';
import {
  fetchFirstRunStepCounts,
  FIRST_RUN_STEPS,
  type FirstRunStepCounts,
} from './first-run-progress-service';
import { useCurrentPathname } from './use-current-pathname';

/**
 * دليل البداية — Stream A (تبسيط التجربة الأولى).
 *
 * بطاقة على صفحة «اليوم» تقود المستخدم الجديد في 4 خطوات واضحة بالعربي:
 * عقار → وحدة → شخص → عقد. الخطوات اللي خلصت بتتعلم صح بناء على عدد
 * السجلات الفعلي، والدليل يتخفي نهائيا لما الأساسيات تكتمل أو لما المستخدم
 * يطلب إخفاءه. أي فشل في قراءة الأعداد مش بيكسر الصفحة: الدليل يفضل ظاهر
 * بالخطوات من غير علامات إنجاز.
 */

const DISMISS_STORAGE_KEY = 'malek.first-run-guide.dismissed.v1';

export { FIRST_RUN_STEPS };

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function FirstRunGuide() {
  const pathname = useCurrentPathname();
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  const [counts, setCounts] = useState<FirstRunStepCounts | null>(null);

  const isDashboard = pathname === '/dashboard';

  useEffect(() => {
    if (!isDashboard || dismissed) return;
    let cancelled = false;
    fetchFirstRunStepCounts()
      .then((result) => {
        if (!cancelled) setCounts(result);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isDashboard, dismissed]);

  const completedCount = useMemo(
    () => FIRST_RUN_STEPS.filter((step) => (counts?.[step.key] ?? 0) > 0).length,
    [counts],
  );
  const allDone = counts !== null && completedCount === FIRST_RUN_STEPS.length;

  if (!isDashboard || dismissed || allDone) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // التخزين المحلي مش متاح: الإخفاء يفضل للجلسة الحالية بس.
    }
    setDismissed(true);
  };

  return (
    <section
      data-first-run-guide
      aria-label="دليل البداية"
      className="mx-auto mt-3 w-full max-w-[110rem] px-3 sm:px-4"
    >
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground">أهلا بيك في مالك — ابدأ من هنا</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              أربع خطوات بس وشغلك هيبقى ظاهر قدامك.
              {counts !== null ? ` خلصت ${completedCount} من ${FIRST_RUN_STEPS.length}.` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            data-first-run-guide-dismiss
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-3.5" aria-hidden="true" />
            إخفاء الدليل
          </button>
        </div>

        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {FIRST_RUN_STEPS.map((step, index) => {
            const done = (counts?.[step.key] ?? 0) > 0;
            return (
              <li
                key={step.key}
                data-first-run-step={step.key}
                data-step-done={done ? 'true' : 'false'}
                className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-background/60 p-3"
              >
                <span
                  className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-[12px] font-black text-muted-foreground"
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5 text-success" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-foreground">{step.label}</p>
                  <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{step.hint}</p>
                  {!done ? (
                    <Link
                      to={step.to}
                      data-first-run-step-link={step.key}
                      className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
                    >
                      {step.actionLabel}
                      <CircleArrowLeft className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
