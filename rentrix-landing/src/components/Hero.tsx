import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, Rocket, ChevronDown, TrendingUp, Home } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { APP_URL, whatsappLink } from '../lib/links';
import { BrowserFrame, FrameCaption } from './Frames';
import { CountUp } from './CountUp';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { t, isArabic } = useLanguage();
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;
  const waMessage = isArabic
    ? 'مرحباً، أريد حجز عرض تجريبي لنظام Rentrix لإدارة العقارات.'
    : 'Hi, I would like to book a live demo of Rentrix.';

  return (
    <section id="top" className="bg-noise relative overflow-hidden bg-ink-950">
      {/* Backdrop layers */}
      <div className="bg-grid-dark absolute inset-0" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(59,110,246,0.22),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="animate-float-slow absolute -top-32 start-[-10%] size-[420px] rounded-full bg-brand-600/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="animate-float absolute top-40 end-[-8%] size-[380px] rounded-full bg-cyan-500/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-32 text-center sm:px-6 sm:pt-40">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300">
              <Home className="size-3.5 text-brand-400" />
              {t.hero.badge}
            </span>
            <span className="animate-pulse-ring inline-flex items-center gap-2 rounded-full border border-brand-400/40 bg-brand-500/15 px-4 py-1.5 text-xs font-bold text-brand-300">
              <Rocket className="size-3.5" />
              {t.hero.earlyAccess}
            </span>
          </div>

          <h1 className="mx-auto mt-8 max-w-4xl text-4xl font-extrabold leading-[1.2] tracking-tight text-white sm:text-5xl lg:text-[4rem] lg:leading-[1.15]">
            {t.hero.titleA}{' '}
            <span className="text-gradient">{t.hero.titleB}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg sm:leading-9">
            {t.hero.subtitle}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              href={APP_URL}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-base font-bold text-white shadow-[0_18px_40px_-10px_rgba(37,84,235,0.55)] transition hover:bg-brand-500 sm:w-auto"
            >
              {t.hero.ctaPrimary}
              <ArrowIcon className="size-5" />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              href={whatsappLink(waMessage)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-8 py-4 text-base font-bold text-emerald-300 transition hover:bg-emerald-500/20 sm:w-auto"
            >
              <MessageCircle className="size-5" />
              {t.hero.ctaWhatsapp}
            </motion.a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-400 sm:text-sm">
            {t.hero.trustItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Real product screenshot with floating KPI chips */}
      <div className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
          className="relative"
        >
          {/* Floating chips — real KPIs from the app */}
          <div className="animate-float absolute -top-6 end-2 z-10 hidden items-center gap-2 rounded-2xl border border-white/10 bg-ink-850/90 px-4 py-2.5 shadow-xl backdrop-blur md:flex lg:end-8">
            <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <TrendingUp className="size-4" />
            </span>
            <div className="text-start">
              <p className="text-[10px] text-slate-400">{isArabic ? 'نسبة الإشغال' : 'Occupancy'}</p>
              <p className="text-sm font-extrabold text-white">80%</p>
            </div>
          </div>
          <div
            className="animate-float-slow absolute -bottom-6 start-2 z-10 hidden items-center gap-2 rounded-2xl border border-white/10 bg-ink-850/90 px-4 py-2.5 shadow-xl backdrop-blur md:flex lg:start-8"
            style={{ animationDelay: '1.2s' }}
          >
            <span className="grid size-8 place-items-center rounded-xl bg-brand-500/15 text-brand-400">
              <CheckCircle2 className="size-4" />
            </span>
            <div className="text-start">
              <p className="text-[10px] text-slate-400">{isArabic ? 'التحصيل الشهري' : 'Monthly collection'}</p>
              <p className="text-sm font-extrabold text-white" dir="ltr">
                OMR 12,000
              </p>
            </div>
          </div>

          <BrowserFrame
            src="/screenshots/dashboard.png"
            alt={isArabic ? 'لوحة تحكم Rentrix الحقيقية' : 'The real Rentrix dashboard'}
            url={isArabic ? 'app.rentrix/لوحة-التحكم' : 'app.rentrix/dashboard'}
          />
          <FrameCaption>{t.hero.screenshotCaption}</FrameCaption>
        </motion.div>

        <div className="mt-10 flex justify-center">
          <a
            href="#stats"
            className="flex flex-col items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
          >
            {t.hero.scroll}
            <ChevronDown className="size-4 animate-bounce" />
          </a>
        </div>
      </div>

      {/* Stats strip */}
      <div id="stats" className="relative border-t border-white/5 bg-ink-900/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-white/5 px-4 py-10 sm:divide-x lg:grid-cols-4 rtl:divide-x-reverse">
          {t.stats.map((stat) => (
            <div key={stat.label} className="px-4 py-4 text-center sm:py-0">
              <CountUp
                value={stat.value}
                suffix={stat.suffix}
                className="text-gradient text-3xl font-extrabold sm:text-4xl"
              />
              <p className="mt-2 text-xs text-slate-400 sm:text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
