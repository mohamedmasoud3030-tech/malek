import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MessageCircle, Zap, Headset, Handshake } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { APP_URL, whatsappLink } from '../lib/links';
import { Reveal } from './Reveal';

export function FinalCta() {
  const { t, isArabic } = useLanguage();
  const ForwardArrow = isArabic ? ArrowLeft : ArrowRight;
  const waMessage = isArabic
    ? 'مرحباً، أريد حجز عرض تجريبي لنظام Rentrix لإدارة العقارات.'
    : 'Hi, I would like to book a live demo of Rentrix.';

  return (
    <section className="relative overflow-hidden bg-ink-950">
      <div className="bg-grid-dark absolute inset-0 opacity-70" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(55%_60%_at_50%_100%,rgba(59,110,246,0.28),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="animate-float absolute start-[8%] top-16 size-64 rounded-full bg-brand-600/20 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="animate-float-slow absolute end-[6%] bottom-24 size-64 rounded-full bg-cyan-500/15 blur-[110px]"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <Reveal>
          <h2 className="text-3xl font-extrabold leading-[1.25] tracking-tight text-white sm:text-5xl sm:leading-[1.2]">
            {t.cta.titleA}{' '}
            <span className="text-gradient">{t.cta.titleB}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            {t.cta.subtitle}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href={APP_URL}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-9 py-4 text-base font-bold text-white shadow-[0_20px_45px_-12px_rgba(37,84,235,0.6)] transition hover:bg-brand-500 sm:w-auto"
            >
              {t.cta.primary}
              <ForwardArrow className="size-5" />
            </motion.a>
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href={whatsappLink(waMessage)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-9 py-4 text-base font-bold text-emerald-300 transition hover:bg-emerald-500/20 sm:w-auto"
            >
              <MessageCircle className="size-5" />
              {t.cta.whatsapp}
            </motion.a>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-4 text-amber-300" />
              {t.cta.note.split('•')[0]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Headset className="size-4 text-brand-300" />
              {t.cta.note.split('•')[1]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Handshake className="size-4 text-emerald-300" />
              {t.cta.note.split('•')[2]}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
