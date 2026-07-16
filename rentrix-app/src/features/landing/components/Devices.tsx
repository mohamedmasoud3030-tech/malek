import { CheckCircle2, Moon, Smartphone, Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';
import { BrowserFrame, PhoneFrame } from './Frames';
import { APP_HOST } from '../constants';

const BULLET_ICONS = [Globe, Smartphone, Moon];

export function Devices() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-ink-950">
      <div
        aria-hidden="true"
        className="absolute top-1/3 start-[-10%] size-[420px] rounded-full bg-brand-600/15 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-20%] end-[-6%] size-[380px] rounded-full bg-cyan-500/12 blur-[130px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          kicker={t.devices.kicker}
          title={t.devices.title}
          subtitle={t.devices.subtitle}
        />

        <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-8">
          <Reveal>
            <div className="relative max-w-2xl">
              <BrowserFrame
                src="/landing/dashboard-dark.png"
                alt={t.devices.darkLabel}
                url={APP_HOST}
              />
              {/* Floating chips over the frame */}
              <span className="absolute -top-4 end-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-850/95 px-4 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur">
                <Moon className="size-3.5 text-indigo-300" />
                {t.devices.darkLabel}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.15} className="relative mx-auto">
            <PhoneFrame src="/landing/mobile-light.png" alt={t.devices.mobileLabel} />
            <span className="absolute -top-4 start-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-ink-850/95 px-4 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur rtl:translate-x-1/2">
              <Smartphone className="size-3.5 text-emerald-300" />
              {t.devices.mobileLabel}
            </span>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {t.devices.bullets.map((bullet, i) => {
            const Icon = BULLET_ICONS[i];
            return (
              <Reveal key={bullet} delay={i * 0.08} className="h-full">
                <div className="glass-card flex h-full items-center gap-3 rounded-2xl p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-bold leading-7 text-slate-200">{bullet}</p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1} className="mt-8 flex justify-center">
          <p className="inline-flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="size-4 text-emerald-400" />
            {t.hero.trustItems[2]}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
