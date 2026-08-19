import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_LOCKUP_ASSET, APP_BRAND_NAME } from '@/lib/brand';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';
import { SUPPORT_CONTACTS } from '@/lib/contact';
import { getLoginErrorMessage } from './login-error-message';

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
      className="relative min-h-screen min-h-dvh w-full overflow-hidden px-5 py-8 sm:px-6"
      data-login-surface
      dir="rtl"
    >
      {/* MALEK ambient brand backdrop — a soft blue glow, not a flat surface */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-[28rem] w-[28rem] rounded-full bg-primary/8 blur-3xl" />
      </div>

      <section className="safe-top-app safe-bottom-overlay mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26rem] flex-col justify-center" data-login-main>
        <div className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-card backdrop-blur-sm sm:p-8" data-login-card>
          <header className="mb-8 text-center" data-login-brand>
            <img src={APP_BRAND_LOCKUP_ASSET} alt={APP_BRAND_NAME} className="mx-auto size-16 object-contain sm:size-[4.5rem]" data-malek-canonical-lockup />
            <h1 className="mt-5 text-2xl font-extrabold text-foreground">مرحبًا بعودتك</h1>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground" data-login-tagline>سجّل الدخول إلى مساحة عملك في {APP_BRAND_NAME}</p>
          </header>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate={false} aria-describedby={hasFieldError ? 'login-error' : undefined}>
          <div className="grid gap-1.5">
            <label htmlFor="login-email" className="text-sm font-semibold text-foreground">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
              <Input id="login-email" className="h-12 rounded-xl bg-card pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFormError(null); }} required autoComplete="email" inputMode="email" dir="ltr" placeholder="name@malek.com" disabled={isSubmitting || Boolean(runtimeError)} aria-invalid={hasFieldError || undefined} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold text-foreground">كلمة المرور</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
              <Input id="login-password" className="h-12 rounded-xl bg-card ps-11 pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm" type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setFormError(null); }} onKeyDown={handlePasswordKeyDown} onKeyUp={handleCapsLockDetect} required autoComplete="current-password" dir="ltr" placeholder="••••••••" disabled={isSubmitting || Boolean(runtimeError)} aria-invalid={hasFieldError || undefined} aria-describedby={isCapsLock ? 'caps-lock-warning' : undefined} />
              <button type="button" className="absolute inset-y-0 left-1 my-auto grid size-11 min-h-11 min-w-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} disabled={isSubmitting || Boolean(runtimeError)}>
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

          <footer className="mt-6 text-center" data-contact-footer aria-label="بيانات الدعم والتواصل">
          <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/20" onClick={() => setShowSupport((value) => !value)} aria-expanded={showSupport}>
            <MessageCircle className="size-4" aria-hidden="true" />
            تحتاج مساعدة؟ تواصل معنا
          </button>
          {showSupport ? (
            <div className="mt-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm" data-support-panel>
              <div className="flex flex-wrap justify-center gap-2">
                {[SUPPORT_CONTACTS.oman, SUPPORT_CONTACTS.egypt, SUPPORT_CONTACTS.saudi].map((contact) => <a key={contact.number} href={`tel:${contact.number.replace(/\s+/g, '')}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-xs font-semibold text-foreground hover:text-primary"><span dir="ltr">{contact.number}</span></a>)}
              </div>
              <div className="mt-2 grid gap-1">
                {SUPPORT_CONTACTS.emails.map((contact) => <a key={contact.address} href={`mailto:${contact.address}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"><Mail className="size-3.5" aria-hidden="true" /><span dir="ltr">{contact.address}</span></a>)}
              </div>
            </div>
          ) : null}
          </footer>
        </div>
      </section>
    </main>
  );
}
