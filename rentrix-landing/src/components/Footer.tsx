import { Mail, MessageCircle, Heart } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { APP_HOST, APP_URL, CONTACT_EMAIL, whatsappLink } from '../lib/links';

export function Footer() {
  const { t, isArabic } = useLanguage();
  const year = new Date().getFullYear();
  const productHrefs = ['#features', '#showcase', '#how', '#faq'];
  const companyHrefs = [
    whatsappLink(isArabic ? 'مرحباً، أريد الاستفسار عن Rentrix.' : 'Hi, I want to ask about Rentrix.'),
    `mailto:${CONTACT_EMAIL}`,
  ];

  return (
    <footer className="border-t border-white/5 bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/icon-rentrix.png" alt="Rentrix" className="size-9 rounded-xl" />
              <span className="text-xl font-extrabold tracking-tight text-white" dir="ltr">
                Rentrix
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-slate-400">{t.footer.tagline}</p>
            <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Heart className="size-3.5 text-rose-400" />
              {t.footer.motto}
            </p>
          </div>

          {/* Product */}
          <nav aria-label={t.footer.productTitle}>
            <h3 className="text-sm font-extrabold text-white">{t.footer.productTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {t.footer.productLinks.map((link, i) => (
                <li key={link}>
                  <a
                    href={productHrefs[i]}
                    className="text-sm text-slate-400 transition hover:text-white"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav aria-label={t.footer.companyTitle}>
            <h3 className="text-sm font-extrabold text-white">{t.footer.companyTitle}</h3>
            <ul className="mt-4 space-y-2.5">
              {t.footer.companyLinks.map((link, i) => (
                <li key={link}>
                  <a
                    href={companyHrefs[i]}
                    target={i === 0 ? '_blank' : undefined}
                    rel={i === 0 ? 'noreferrer' : undefined}
                    className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                  >
                    {i === 0 ? <MessageCircle className="size-4" /> : <Mail className="size-4" />}
                    {link}
                  </a>
                </li>
              ))}
              <li>
                <a href={APP_URL} className="text-sm text-brand-400 transition hover:text-brand-300" dir="ltr">
                  {APP_HOST}
                </a>
              </li>
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-extrabold text-white">{t.footer.contactTitle}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-white" dir="ltr">
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a
                  href={whatsappLink(isArabic ? 'مرحباً' : 'Hi')}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-white"
                >
                  {isArabic ? 'واتساب — رد سريع' : 'WhatsApp — quick reply'}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {year} <span dir="ltr">Rentrix</span>. {t.footer.rights}
          </p>
          <p className="text-xs text-slate-600" dir="ltr">
            {APP_HOST} — property management, simplified.
          </p>
        </div>
      </div>
    </footer>
  );
}
