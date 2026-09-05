import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Languages, Menu, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MalikBrand } from '@/components/brand/malik-brand';
import { useLanguage } from '../i18n/LanguageContext';

export function NavBar() {
  const { t, isArabic, toggle } = useLanguage();
  const [open, setOpen] = useState(false);

  const ArrowIcon = isArabic ? ArrowLeft : ArrowRight;
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 px-3 py-3 backdrop-blur sm:px-6">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-card sm:px-5">
        {/* The marketing page is retired, so the brand mark goes to the app entry. */}
        <a
          href="/"
          data-internal
          className="flex items-center gap-2.5"
          aria-label="MALEK"
        >
          <MalikBrand />
        </a>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={toggle}
            className="min-h-11 gap-1.5 rounded-xl border-border bg-background px-3 text-xs font-bold hover:bg-muted"
            aria-label="Switch language"
          >
            <Languages className="size-4" />
            <span>{isArabic ? 'EN' : 'ع'}</span>
          </Button>
          <Link
            to="/login"
            className="hidden min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:inline-flex"
          >
            {t.nav.start}
            <ArrowIcon className="size-4" />
          </Link>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl border-border bg-background text-foreground hover:bg-muted lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </nav>

      {open ? (
        <div className="absolute inset-x-3 top-[76px] z-40 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-elevated sm:inset-x-6 lg:hidden">
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
