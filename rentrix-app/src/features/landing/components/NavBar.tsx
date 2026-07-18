import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { Languages, Menu, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const SECTION_IDS = ['problems', 'features', 'showcase', 'how', 'security', 'faq'] as const;
type SectionId = (typeof SECTION_IDS)[number];

export function NavBar({ anchoredToHome = false }: { anchoredToHome?: boolean }) {
  const { t, isArabic, toggle } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // On sub-pages (privacy/terms) section anchors must first navigate home.
  const sectionHref = (id: SectionId) => (anchoredToHome ? `/#${id}` : `#${id}`);
  const internalAttrs = anchoredToHome ? { 'data-internal': true } : {};

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const labels: Record<SectionId, string> = {
    problems: t.nav.problems,
    features: t.nav.features,
    showcase: t.nav.showcase,
    how: t.nav.how,
    security: t.nav.security,
    faq: t.nav.faq,
  };

  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-6">
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 transition-all duration-300 sm:px-5 ${
          scrolled
            ? 'border-white/10 bg-ink-900/85 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
      >
        <a
          href={anchoredToHome ? '/' : '#top'}
          {...(anchoredToHome ? { 'data-internal': true } : {})}
          className="flex items-center gap-2.5"
        >
          <img src="/icon-rentrix-192.png" alt="Rentrix" width="36" height="36" className="size-9 rounded-xl" />
          <span className="text-xl font-extrabold tracking-tight text-white" dir="ltr">
            Rentrix
          </span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {SECTION_IDS.map((id) => (
            <a
              key={id}
              href={sectionHref(id)}
              {...internalAttrs}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {labels[id]}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
            aria-label="Switch language"
          >
            <Languages className="size-4" />
            <span>{isArabic ? 'EN' : 'ع'}</span>
          </button>
          <Link
            to="/login"
            className="hidden items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-500 sm:inline-flex"
          >
            {t.nav.start}
            <ArrowIcon className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-x-3 top-[72px] z-40 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-2xl backdrop-blur-xl sm:inset-x-6 lg:hidden"
          >
            {SECTION_IDS.map((id) => (
              <a
                key={id}
                href={sectionHref(id)}
                {...internalAttrs}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                {labels[id]}
              </a>
            ))}
            <Link
              to="/login"
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              {t.nav.start}
              <ArrowIcon className="size-4" />
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
