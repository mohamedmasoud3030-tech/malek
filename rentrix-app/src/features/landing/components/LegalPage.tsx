import { Link } from '@tanstack/react-router';
import { useLanguage } from '../i18n/LanguageContext';
import { legalContent } from '../i18n/legal';
import type { LegalSlug } from '../i18n/legal';
import { NavBar } from './NavBar';
import { Footer } from './Footer';
import { Reveal } from './Reveal';
import { ArrowLeft, ArrowRight, Scale } from 'lucide-react';

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const { lang, isArabic } = useLanguage();
  const content = legalContent[slug][lang];
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-ink-950">
      <NavBar anchoredToHome />
      <main className="relative overflow-hidden pb-20 pt-32 sm:pt-40">
        <div className="bg-grid-dark absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(55%_60%_at_50%_0%,rgba(59,110,246,0.18),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <BackIcon className="size-4" />
              {isArabic ? 'العودة للرئيسية' : 'Back to home'}
            </Link>

            <div className="mt-8 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-500/15 text-brand-400">
                <Scale className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {content.title}
                </h1>
                <p className="mt-1 text-xs text-slate-500">{content.effective}</p>
              </div>
            </div>

            <p className="mt-6 text-base leading-8 text-slate-400">{content.intro}</p>
          </Reveal>

          <div className="mt-10 space-y-8">
            {content.sections.map((section, i) => (
              <Reveal key={section.heading} delay={Math.min(i * 0.04, 0.2)}>
                <section className="glass-card rounded-2xl p-6 sm:p-7">
                  <h2 className="text-lg font-extrabold text-white">{section.heading}</h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph) => (
                      <p key={paragraph.slice(0, 24)} className="text-sm leading-8 text-slate-400">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
