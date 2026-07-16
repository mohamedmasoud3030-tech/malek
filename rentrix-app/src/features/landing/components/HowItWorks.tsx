import { Building2, FileSignature, LineChart } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

const STEP_ICONS = [Building2, FileSignature, LineChart];
const STEP_TONES = [
  'bg-brand-600/15 text-brand-600',
  'bg-cyan-500/15 text-cyan-600',
  'bg-emerald-500/15 text-emerald-600',
];

export function HowItWorks() {
  const { t } = useLanguage();

  return (
    <section id="how" className="section-light bg-grid-light relative overflow-hidden border-t border-slate-200/70">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          tone="light"
          kicker={t.how.kicker}
          title={t.how.title}
          subtitle={t.how.subtitle}
        />

        <div className="relative mt-16">
          {/* connecting line (desktop) */}
          <div
            aria-hidden="true"
            className="absolute inset-x-[12%] top-10 hidden border-t-2 border-dashed border-slate-300 lg:block"
          />
          <div className="grid gap-8 lg:grid-cols-3">
            {t.how.steps.map((step, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <Reveal key={step.title} delay={i * 0.12}>
                  <div className="relative text-center">
                    <div className="relative z-10 mx-auto grid size-20 place-items-center rounded-3xl">
                      <span
                        className={`grid size-16 place-items-center rounded-2xl ${STEP_TONES[i]} ring-8 ring-slate-50`}
                      >
                        <Icon className="size-7" aria-hidden="true" />
                      </span>
                      <span className="absolute -top-2 -end-2 grid size-7 place-items-center rounded-full bg-slate-900 text-[11px] font-extrabold text-white">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-6 text-lg font-extrabold text-slate-900 sm:text-xl">
                      {step.title}
                    </h3>
                    <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-slate-600">
                      {step.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
