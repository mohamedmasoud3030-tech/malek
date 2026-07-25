import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Languages, Menu, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

const SECTION_IDS = ['problems', 'features', 'showcase', 'how', 'security', 'faq'] as const;
type SectionId = (typeof SECTION_IDS)[number];

export function NavBar({ anchoredToHome = false }: { anchoredToHome?: boolean }) {
  const { t, isArabic, toggle } = useLanguage();
  const [open, setOpen] = useState(false);

  const sectionHref = (id: SectionId) => (anchoredToHome ? `/#${id}` : `#${id}`);
  const internalAttrs = anchoredToHome ? { 'data-internal': true } : {};
  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;
  const labels: Record<SectionId, string> = {
    problems: t.nav.problems,
    features: t.nav.features,
    showcase: t.nav.showcase,
    how: t.nav.how,
    security: t.nav.security,
    faq: t.nav.faq,
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 px-3 py-3 backdrop-blur sm:px-6">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-card sm:px-5">
        <a
          href={anchoredToHome ? '/' : '#top'}
          {...(anchoredToHome ? { 'data-internal': true } : {})}
          className="flex items-center gap-2.5"
        >
          <img src="/icon-rentrix-192.png" alt="Rentrix" width="36" height="36" className="size-9 rounded-xl" />
          <span className="text-xl font-extrabold tracking-tight text-foreground" dir="ltr">
            Rentrix
          </span>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {SECTION_IDS.map((id) => (
            <a
              key={id}
              href={sectionHref(id)}
              {...internalAttrs}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {labels[id]}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
            aria-label="Switch language"
          >
            <Languages className="size-4" />
            <span>{isArabic ? 'EN' : 'ع'}</span>
          </button>
          <Link
            to="/login"
            className="hidden min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:inline-flex"
          >
            {t.nav.start}
            <ArrowIcon className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-xl border border-border bg-background text-foreground lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="absolute inset-x-3 top-[76px] z-40 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-elevated sm:inset-x-6 lg:hidden">
          {SECTION_IDS.map((id) => (
            <a
              key={id}
              href={sectionHref(id)}
              {...internalAttrs}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {labels[id]}
            </a>
          ))}
          <Link
            to="/login"
            className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            {t.nav.start}
            <ArrowIcon className="size-4" />
          </Link>
        </div>
      ) : null}
    </header>
  );
}
