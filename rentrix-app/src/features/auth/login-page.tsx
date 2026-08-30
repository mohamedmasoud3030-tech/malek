import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { lenaHousePublicEntry } from '@/lib/lena-endorsement';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { MalikBrand } from '@/components/brand/malik-brand';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';
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
  const isSubmittingRef = useRef(false);
  const hasFieldError = Boolean(formError || runtimeError);
  const lenaHref = lenaHousePublicEntry();

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
      <section className="safe-top-app safe-bottom-overlay mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26rem] flex-col justify-start md:justify-center" data-login-main>
        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:p-7" data-login-card>
          <header className="mb-6 flex flex-col items-center justify-center text-center" data-login-brand>
            <h1 className="sr-only">تسجيل الدخول إلى MALEK</h1>
            <MalikBrand layout="vertical" showTagline className="gap-3" markClassName="size-12 sm:size-14" />
          </header>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate={false} aria-describedby={hasFieldError ? 'login-error' : undefined}>
          <div className="grid gap-1.5">
            <label htmlFor="login-email" className="text-sm font-semibold text-foreground">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-[18px] text-muted-foreground" aria-hidden="true" />
              <Input id="login-email" className="h-12 rounded-xl bg-card pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setFormError(null); }} required autoComplete="email" inputMode="email" dir="ltr" placeholder="name@malek.com" disabled={isSubmitting || Boolean(runtimeError)} aria-invalid={hasFieldError || undefined} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="login-password" className="text-sm font-semibold text-foreground">كلمة المرور</label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-[18px] text-muted-foreground" aria-hidden="true" />
              <Input id="login-password" className="h-12 rounded-xl bg-card ps-11 pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm" type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setFormError(null); }} onKeyDown={handlePasswordKeyDown} onKeyUp={handleCapsLockDetect} required autoComplete="current-password" dir="ltr" placeholder="••••••••" disabled={isSubmitting || Boolean(runtimeError)} aria-invalid={hasFieldError || undefined} aria-describedby={isCapsLock ? 'caps-lock-warning' : undefined} />
              <button type="button" className="absolute inset-y-0 end-1 my-auto grid size-11 min-h-11 min-w-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} disabled={isSubmitting || Boolean(runtimeError)}>
                {isPasswordVisible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
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
        </div>

        {/* Parent company endorsement — secondary to Login, not a support CTA. Native <a> to LENA's independent site. */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground" data-lena-endorsement>
          <span>تم تطوير MALEK بواسطة </span>
          {lenaHousePublicEntry() ? (
            <a
              href={lenaHousePublicEntry()}
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-0.5 rounded-lg px-1 font-semibold text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              LENA Digital House
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="font-semibold text-muted-foreground">LENA Digital House</span>
          )}
        </p>
      </section>
    </main>
  );
}
