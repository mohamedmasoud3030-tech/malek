import { motion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, MessageCircle, Zap, Headset, Handshake } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { whatsappLink } from '../constants';
import { Reveal } from './Reveal';

export function FinalCta() {
  const { t, isArabic } = useLanguage();
  const ForwardArrow = isArabic ? ArrowLeft : ArrowRight;
  const waMessage = isArabic
    ? 'مرحباً، أريد حجز عرض تجريبي لنظام Rentrix لإدارة العقارات.'
    : 'Hi, I would like to book a live demo of Rentrix.';

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="bg-grid-dark absolute inset-0 opacity-70" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[420px] bg-[radial-gradient(55%_60%_at_50%_100%,rgba(59,110,246,0.28),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="absolute start-[8%] top-16 size-64 rounded-full bg-primary/20 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="absolute end-[6%] bottom-24 size-64 rounded-full bg-info-bg blur-[110px]"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <Reveal>
          <h2 className="text-3xl font-extrabold leading-[1.25] tracking-tight text-primary-foreground sm:text-5xl sm:leading-[1.2]">
            {t.cta.titleA}{' '}
            <span className="text-gradient">{t.cta.titleB}</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            {t.cta.subtitle}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-9 py-4 text-base font-bold text-primary-foreground shadow-[0_20px_45px_-12px_rgba(37,84,235,0.6)] transition hover:bg-primary sm:w-auto"
              >
                {t.cta.primary}
                <ForwardArrow className="size-5" />
              </Link>
            </motion.div>
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              href={whatsappLink(waMessage)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-success/30 bg-success-bg/10 px-9 py-4 text-base font-bold text-success transition hover:bg-success-bg/20 sm:w-auto"
            >
              <MessageCircle className="size-5" />
              {t.cta.whatsapp}
            </motion.a>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-4 text-warning" />
              {t.cta.note.split('•')[0]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Headset className="size-4 text-primary" />
              {t.cta.note.split('•')[1]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Handshake className="size-4 text-success" />
              {t.cta.note.split('•')[2]}
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
