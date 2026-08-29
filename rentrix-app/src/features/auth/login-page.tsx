import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { MalikBrand } from '@/components/brand/malik-brand';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';
import { SUPPORT_CONTACTS } from '@/lib/contact';
import { getLoginErrorMessage } from './login-error-message';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.15 6.42 2.15 11.88c0 1.74.46 3.44 1.32 4.92L2 22l5.33-1.4a9.78 9.78 0 0 0 4.7 1.2h.01c5.46 0 9.89-4.42 9.89-9.88 0-2.64-1.03-5.12-2.88-6.97Zm-7.01 15.24h-.01a8.15 8.15 0 0 1-4.15-1.13l-.3-.18-3.16.83.84-3.08-.2-.32a8.2 8.2 0 0 1-1.27-4.39c0-4.54 3.7-8.23 8.26-8.23 2.2 0 4.27.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.8c0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.57.13-.17.25-.66.81-.81.97-.15.17-.3.19-.55.07-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.38-.78-1.89-.2-.49-.41-.42-.57-.43h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.12.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const envDiagnostics = getEnvDiagnostics();
  const runtimeError = envDiagnostics[0]?.messageAr ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCapsLock, setIsCapsLock] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const isSubmittingRef = useRef(false);
  const hasFieldError = Boolean(formError || runtimeError);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (runtimeError || isSubmittingRef.current) return;
    setFormError(null);
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      await login(email, password);
      toast.success('تم تسجيل الدخول بنجاح');
    } catch (error) {
      setFormError(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [email, login, password, runtimeError]);

  const handlePasswordKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.form?.requestSubmit();
  }, []);

  const handleCapsLockDetect = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') setIsCapsLock(event.getModifierState('CapsLock'));
  }, []);

  return (
    <main
      className="relative min-h-screen min-h-dvh w-full min-w-0 overflow-x-hidden px-4 py-8 sm:px-6"
      data-login-surface
      dir="rtl"
    >
      <section className="safe-top-app safe-bottom-overlay mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26rem] flex-col justify-center" data-login-main>
        <div className="rounded-2xl border border-border/70 bg-card/90 p-6 shadow-card backdrop-blur-sm sm:p-8" data-login-card>
          <header className="mb-8 flex flex-col items-center justify-center text-center" data-login-brand>
            <h1 className="sr-only">تسجيل الدخول إلى MALEK</h1>
            <MalikBrand layout="vertical" showTagline className="gap-4" markClassName="size-14 sm:size-16" />
          </header>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate={false} aria-describedby={hasFieldError ? 'login-error' : undefined}>
          <div className="grid gap-1.5">
            <label htmlFor="login-email" className="text-sm font-semibold text-foreground">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
              <Input id="login-email" className="h-12 rounded-xl bg-card pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFormError(null); }} required autoComplete="email" inputMode="email" dir="ltr" placeholder="name@malek.com" disabled={isSubmitting || Boolean(runtimeError)} aria-invalid={hasFieldError || undefined} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold text-foreground">كلمة المرور</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
              <Input id="login-password" className="h-12 rounded-xl bg-card ps-11 pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm" type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setFormError(null); }} onKeyDown={handlePasswordKeyDown} onKeyUp={handleCapsLockDetect} required autoComplete="current-password" dir="ltr" placeholder="••••••••" disabled={isSubmitting || Boolean(runtimeError)} aria-invalid={hasFieldError || undefined} aria-describedby={isCapsLock ? 'caps-lock-warning' : undefined} />
              <button type="button" className="absolute inset-y-0 end-1 my-auto grid size-11 min-h-11 min-w-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} disabled={isSubmitting || Boolean(runtimeError)}>
                {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {isCapsLock ? <p id="caps-lock-warning" className="flex items-center gap-1.5 text-xs text-warning" role="status"><AlertTriangle className="size-3.5" />مفتاح Caps Lock مفعّل</p> : null}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-primary/20">نسيت كلمة المرور؟</Link>
            </div>
          </div>

          {hasFieldError ? <div id="login-error" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/5 p-3 text-danger" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div className="text-xs leading-relaxed">{runtimeError ?? formError}</div></div> : null}

          <Button className="h-12 w-full gap-2 rounded-xl text-base font-bold shadow-sm transition-all active:scale-[0.99] md:text-sm" type="submit" disabled={isSubmitting || Boolean(runtimeError)} aria-busy={isSubmitting}>
            {isSubmitting ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />جارٍ التحقق...</> : <>تسجيل الدخول<ArrowLeft className="size-4 rtl:rotate-180" /></>}
          </Button>
          </form>

          <footer className="mt-8 border-t border-border/40 pt-6" data-contact-footer aria-label="بيانات الدعم والتواصل">
            <button
              type="button"
              className="mx-auto flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/20 px-4 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20"
              onClick={() => setShowSupport((value) => !value)}
              aria-expanded={showSupport}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              {showSupport ? 'إخفاء بيانات التواصل' : 'تحتاج مساعدة؟ تواصل معنا'}
            </button>

            {showSupport ? (
              <div className="mt-5 space-y-5" data-support-panel>
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="grid size-6 place-items-center rounded-full bg-success/10 text-success">
                      <WhatsAppIcon className="size-3.5" />
                    </span>
                    واتساب
                  </p>
                  <div className="grid gap-2.5">
                    {[SUPPORT_CONTACTS.oman, SUPPORT_CONTACTS.egypt, SUPPORT_CONTACTS.saudi].map((contact) => (
                      <a
                        key={contact.number}
                        href={contact.whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-start shadow-sm transition-all hover:border-success/30 hover:bg-success/5 hover:shadow"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/10 text-success transition-colors group-hover:bg-success group-hover:text-white">
                          <WhatsAppIcon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">{contact.label}</p>
                          <p dir="ltr" className="mt-0.5 text-sm font-bold tracking-wide text-foreground">
                            {contact.number}
                          </p>
                        </div>
                        <ArrowLeft className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:-translate-x-0.5 group-hover:text-success rtl:rotate-180" />
                      </a>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary">
                      <Mail className="size-3.5" />
                    </span>
                    البريد الإلكتروني
                  </p>
                  <div className="grid gap-2.5">
                    {SUPPORT_CONTACTS.emails.map((contact) => (
                      <a
                        key={contact.address}
                        href={`mailto:${contact.address}`}
                        className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-start shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Mail className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">{contact.label}</p>
                          <p dir="ltr" className="mt-0.5 truncate text-sm font-semibold text-foreground">
                            {contact.address}
                          </p>
                        </div>
                        <ArrowLeft className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:-translate-x-0.5 group-hover:text-primary rtl:rotate-180" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </footer>
        </div>
      </section>
    </main>
  );
}
