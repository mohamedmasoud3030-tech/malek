import { ArrowLeft, ArrowRight, MoveDown, XCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

export function ProblemSolution() {
  const { t, isArabic } = useLanguage();
  const ForwardArrow = isArabic ? ArrowLeft : ArrowRight;

  return (
    <section id="problems" className="section-light bg-grid-light relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 start-1/4 size-96 rounded-full bg-primary/10 blur-[100px]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          tone="light"
          kicker={t.problems.kicker}
          title={t.problems.title}
          subtitle={t.problems.subtitle}
        />

        <div className="mx-auto mt-14 max-w-5xl">
          <Reveal className="mb-5 hidden grid-cols-[1fr_auto_1fr] items-center gap-4 lg:grid">
            <p className="text-center text-sm font-bold text-danger">{t.problems.painTitle}</p>
            <span className="size-6" />
            <p className="text-center text-sm font-bold text-success">{t.problems.solutionTitle}</p>
          </Reveal>

          <div className="space-y-4">
            {t.problems.items.map((item, i) => (
              <Reveal key={item.pain} delay={i * 0.06}>
                <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
                  {/* Pain */}
                  <div className="group flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-bg p-5 transition duration-300 hover:border-danger/40 hover:bg-danger-bg">
                    <XCircle className="mt-0.5 size-5 shrink-0 text-danger transition group-hover:scale-110" />
                    <p className="text-sm font-semibold leading-7 text-danger line-through decoration-danger/40 decoration-2">
                      {item.pain}
                    </p>
                  </div>

                  {/* Connector */}
                  <div className="flex items-center justify-center">
                    <ForwardArrow className="hidden size-5 text-primary lg:block" />
                    <MoveDown className="size-5 text-primary lg:hidden" />
                  </div>

                  {/* Solution */}
                  <div className="group flex items-start gap-3 rounded-2xl border border-success/30 bg-success-bg p-5 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.5)] transition duration-300 hover:border-success/40 hover:bg-success-bg">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success transition group-hover:scale-110" />
                    <p className="text-sm font-bold leading-7 text-success">{item.solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} className="mt-10 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-brand-50 px-5 py-2.5 text-sm font-bold text-brand-700">
              <Sparkles className="size-4" />
              {t.problems.footnote}
            </span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
