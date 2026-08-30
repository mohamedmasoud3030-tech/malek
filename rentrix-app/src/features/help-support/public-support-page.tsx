import { Link } from '@tanstack/react-router';
import { ArrowLeft, LifeBuoy, Mail, MessageCircle } from 'lucide-react';
import { MalikBrand } from '@/components/brand/malik-brand';
import { SUPPORT_CONTACTS } from '@/lib/contact';

/**
 * Public-safe support surface for unauthenticated visitors (login / forgot
 * password). It renders only static contact channels — WhatsApp and email —
 * with NO auth, Supabase, company membership, or support-ticket intake
 * (that remains on the authenticated /help workspace, which requires a
 * signed-in company member). Deliberately does not ship the heavy contact
 * inventory inside the login card.
 */
export function PublicSupportPage() {
  return (
    <main
      className="min-h-screen min-h-dvh w-full min-w-0 overflow-x-hidden bg-background px-4 py-8 sm:px-6"
      data-public-support-surface
      dir="rtl"
    >
      <section className="safe-top-app safe-bottom-overlay mx-auto w-full max-w-[26rem]">
        <header className="mb-6 flex flex-col items-center text-center" data-public-support-brand>
          <MalikBrand layout="vertical" showTagline className="gap-3" markClassName="size-12 sm:size-14" />
          <h1 className="sr-only">الدعم والتواصل</h1>
        </header>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6" data-public-support-card>
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-base font-extrabold text-foreground">الدعم والتواصل</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            تواصل مع فريق MALEK مباشرة عبر القنوات التالية. للمشاكل داخل حسابك،
            استخدم «طلب دعم آمن» بعد تسجيل الدخول.
          </p>

          <div className="mt-5 space-y-4">
            <section aria-labelledby="public-support-whatsapp">
              <h2 id="public-support-whatsapp" className="mb-2 text-xs font-bold text-muted-foreground">
                واتساب
              </h2>
              <div className="grid gap-2">
                {[SUPPORT_CONTACTS.oman, SUPPORT_CONTACTS.egypt, SUPPORT_CONTACTS.saudi].map((contact) => (
                  <a
                    key={contact.number}
                    href={contact.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success" aria-hidden="true">
                      <MessageCircle className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-muted-foreground">{contact.label}</span>
                      <span dir="ltr" className="block text-sm font-bold tracking-wide text-foreground">{contact.number}</span>
                    </span>
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground/50 rtl:rotate-180" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>

            <section aria-labelledby="public-support-email">
              <h2 id="public-support-email" className="mb-2 text-xs font-bold text-muted-foreground">
                البريد الإلكتروني
              </h2>
              <div className="grid gap-2">
                {SUPPORT_CONTACTS.emails.map((contact) => (
                  <a
                    key={contact.address}
                    href={`mailto:${contact.address}`}
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-start transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                      <Mail className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-muted-foreground">{contact.label}</span>
                      <span dir="ltr" className="block truncate text-sm font-semibold text-foreground">{contact.address}</span>
                    </span>
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground/50 rtl:rotate-180" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            العودة إلى تسجيل الدخول
          </Link>
        </div>
      </section>
    </main>
  );
}
