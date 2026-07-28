import { Link } from '@tanstack/react-router';
import { Mail, MessageCircle, Heart } from 'lucide-react';
import { APP_BRAND_NAME } from '@/lib/brand';
import { useLanguage } from '../i18n/LanguageContext';
import { APP_HOST, CONTACT_EMAIL, whatsappLink } from '../constants';

export function Footer() {
  const { t, isArabic } = useLanguage();
  const year = new Date().getFullYear();
  const productHrefs = ['#features', '#showcase', '#how', '#faq'];
  const companyHrefs = [
    whatsappLink(
      isArabic ? `مرحباً، أريد الاستفسار عن ${APP_BRAND_NAME}.` : `Hi, I want to ask about ${APP_BRAND_NAME}.`,
    ),
    `mailto:${CONTACT_EMAIL}`,
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="malik-wordmark tracking-[0.16em] text-xl font-extrabold text-foreground" dir="ltr">
                {APP_BRAND_NAME}
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">{t.footer.tagline}</p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Heart className="size-3.5 text-danger" />
              {t.footer.motto}
            </p>
          </div>

          <nav aria-label={t.footer.productTitle}>
            <h3 className="text-sm font-extrabold text-foreground">{t.footer.productTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {t.footer.productLinks.map((link, index) => (
                <li key={link}>
                  <a href={productHrefs[index]} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t.footer.companyTitle}>
            <h3 className="text-sm font-extrabold text-foreground">{t.footer.companyTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {t.footer.companyLinks.map((link, index) => (
                <li key={link}>
                  <a
                    href={companyHrefs[index]}
                    target={index === 0 ? '_blank' : undefined}
                    rel={index === 0 ? 'noreferrer' : undefined}
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                  >
                    {index === 0 ? <MessageCircle className="size-4" /> : <Mail className="size-4" />}
                    {link}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/login" className="text-sm text-primary transition hover:text-primary/80">
                  <span dir="ltr">{APP_HOST}</span>
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t.footer.legalTitle}>
            <h3 className="text-sm font-extrabold text-foreground">{t.footer.legalTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {t.footer.legalLinks.map((link, index) => (
                <li key={link}>
                  <Link to={index === 0 ? '/privacy' : '/terms'} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-extrabold text-foreground">{t.footer.contactTitle}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-foreground" dir="ltr">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={whatsappLink(isArabic ? 'مرحباً' : 'Hi')} target="_blank" rel="noreferrer" className="transition hover:text-foreground">
                  {isArabic ? 'واتساب — رد سريع' : 'WhatsApp — quick reply'}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} <span className="malik-wordmark tracking-[0.16em] font-extrabold" dir="ltr">{APP_BRAND_NAME}</span>. {t.footer.rights}
          </p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {APP_HOST} — property management, simplified.
          </p>
        </div>
      </div>
    </footer>
  );
}
