import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useLanguage } from '../i18n/LanguageContext';
import { legalContent, type LegalSlug } from '../i18n/legal';
import { NavBar } from './NavBar';
import { Footer } from './Footer';

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const { lang, isArabic } = useLanguage();
  const content = legalContent[slug][lang];
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar anchoredToHome />
      <main>
        <PageLayout dir={isArabic ? 'rtl' : 'ltr'} lang={lang} contentClassName="max-w-4xl py-8 sm:py-10">
          <PageHeader
            title={content.title}
            description={content.intro}
            secondaryActions={(
              <Button variant="secondary" asChild>
                <Link to="/">
                  <BackIcon className="me-2 size-4" />
                  {isArabic ? 'العودة للرئيسية' : 'Back to home'}
                </Link>
              </Button>
            )}
          />

          <Card>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Scale className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{content.effective}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Rentrix</p>
                </div>
              </div>

              {content.sections.map((section) => (
                <section key={section.heading} className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
                  <h2 className="text-lg font-extrabold text-foreground">{section.heading}</h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph) => (
                      <p key={paragraph.slice(0, 24)} className="text-sm leading-8 text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </CardContent>
          </Card>
        </PageLayout>
      </main>
      <Footer />
    </div>
  );
}
