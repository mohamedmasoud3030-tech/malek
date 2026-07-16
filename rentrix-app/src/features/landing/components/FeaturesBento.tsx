import {
  Wallet,
  FileText,
  PieChart,
  Wrench,
  Users,
  Target,
  Building2,
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

const CARD_ICONS = [Wallet, FileText, PieChart, Wrench, Users, Target, Building2, ClipboardCheck];

export function FeaturesBento() {
  const { t, isArabic } = useLanguage();
  const ForwardArrow = isArabic ? ArrowLeft : ArrowRight;

  return (
    <section id="features" className="relative overflow-hidden bg-ink-950">
      <div className="bg-grid-dark absolute inset-0 opacity-60" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="absolute end-[-10%] top-20 size-[420px] rounded-full bg-brand-600/15 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 start-[-8%] size-[380px] rounded-full bg-cyan-500/10 blur-[130px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          kicker={t.features.kicker}
          title={t.features.title}
          subtitle={t.features.subtitle}
        />

        {/* Spotlight card — real dashboard screenshot */}
        <Reveal className="mt-14">
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-tl from-ink-850 to-ink-900 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]">
            <div className="grid items-center gap-8 p-7 sm:p-10 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <h3 className="text-2xl font-extrabold leading-snug text-white sm:text-3xl">
                  {t.features.spotlight.title}
                </h3>
                <p className="mt-4 text-sm leading-8 text-slate-400 sm:text-base">
                  {t.features.spotlight.description}
                </p>
                <a
                  href="#showcase"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-400 transition hover:gap-3 hover:text-brand-300"
                >
                  {t.showcase.title.split('—')[0]}
                  <ForwardArrow className="size-4" />
                </a>
              </div>
              <div className="relative order-1 lg:order-2">
                <div
                  aria-hidden="true"
                  className="absolute -inset-6 rounded-[2rem] bg-brand-500/20 blur-3xl transition duration-500 group-hover:bg-brand-500/30"
                />
                <img
                  src="/landing/dashboard-dark.png"
                  alt={t.features.spotlight.caption}
                  loading="lazy"
                  className="relative w-full rounded-2xl border border-white/10 shadow-2xl transition duration-500 group-hover:scale-[1.02]"
                />
                <p className="mt-3 text-center text-[11px] text-slate-500">
                  {t.features.spotlight.caption}
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Feature grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4 lg:gap-5">
          {t.features.cards.map((card, i) => {
            const Icon = CARD_ICONS[i % CARD_ICONS.length];
            return (
              <Reveal key={card.title} delay={(i % 4) * 0.07} className="h-full">
                <div className="glass-card group h-full rounded-2xl p-6 transition duration-300 hover:-translate-y-1.5 hover:border-brand-400/40 hover:bg-white/[0.06] hover:shadow-[0_24px_50px_-20px_rgba(59,110,246,0.35)]">
                  <div className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-500/15 text-brand-400 transition duration-300 group-hover:scale-110 group-hover:bg-brand-500/25">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-extrabold text-white sm:text-lg">{card.title}</h3>
                  <p className="mt-2.5 text-[13px] leading-7 text-slate-400">{card.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
