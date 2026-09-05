import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, ArrowUpRight, Eye, EyeOff, Headphones, LockKeyhole, Mail, Menu } from 'lucide-react';
import { EntityForm } from "@/components/ui/entity-form";
import { lenaHousePublicEntry } from '@/lib/lena-endorsement';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ActionMenu } from '@/components/ui/action-menu';
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
  const quickActions = [
    { id: 'support', label: 'الدعم والمساعدة', icon: Headphones, onClick: () => window.location.assign('/support') },
    { id: 'lena', label: 'LENA Digital House', icon: ArrowUpRight, onClick: () => { if (lenaHref) window.open(lenaHref, '_blank', 'noopener,noreferrer'); } },
  ];

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
      className="relative min-h-screen min-h-dvh w-full min-w-0 overflow-x-hidden px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-8"
      data-login-surface
      dir="rtl"
    >
      <div className="absolute right-5 top-[max(0.75rem,env(safe-area-inset-top))] z-10 sm:right-6 sm:top-6">
        <ActionMenu
          items={quickActions}
          label="خيارات المساعدة"
          align="end"
          triggerIcon={<Menu className="size-5" aria-hidden="true" />}
          className="rounded-xl border border-border/70 bg-card/90 shadow-sm"
        />
      </div>
      <section className="safe-top-app safe-bottom-overlay mx-auto flex min-h-[calc(100dvh-1.75rem)] w-full max-w-[23.5rem] flex-col justify-center md:min-h-[calc(100dvh-4rem)] md:max-w-[26rem]" data-login-main>
        <header className="flex shrink-0 flex-col items-center px-4 pb-6 pt-14 text-center sm:pb-7 sm:pt-12 md:px-0 md:pb-7 md:pt-0" data-login-brand>
          <h1 className="sr-only">تسجيل الدخول إلى MALEK</h1>
          <MalikBrand
            layout="vertical"
            showTagline
            className="gap-3 md:gap-2.5"
            markClassName="size-[5.25rem] sm:size-[5.5rem] md:size-[4.75rem]"
            wordmarkClassName="text-[2.35rem] sm:text-[2.5rem] md:text-[2.15rem]"
            wordmarkVariant="brand-gradient"
            taglineClassName="mt-1.5 text-[17px] leading-6 sm:text-lg md:mt-1.5 md:text-base"
          />
        </header>

        <div className="w-full rounded-2xl border border-border/70 bg-card px-5 py-6 shadow-card sm:px-6 sm:py-7" data-login-card>
          <EntityForm.Root className="gap-4" onSubmit={handleSubmit} noValidate={false} aria-describedby={hasFieldError ? 'login-error' : undefined}>
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
                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 end-1 my-auto rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/20" onClick={() => setIsPasswordVisible((visible) => !visible)} aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} disabled={isSubmitting || Boolean(runtimeError)}>
                  {isPasswordVisible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </Button>
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
          </EntityForm.Root>
        </div>

        {/* Parent company endorsement — secondary to Login, not a support CTA. Native <a> to LENA's independent site. */}
        <p className="flex min-h-16 items-center justify-center pt-4 text-center text-xs leading-relaxed text-muted-foreground md:min-h-0 md:pt-5" data-lena-endorsement>
          <span>تم تطوير MALEK بواسطة </span>
          {lenaHref ? (
            <a
              href={lenaHref}
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-0.5 rounded-lg px-1 font-semibold text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-4 focus-visible:ring-primary/20"
              target="_blank"
            >
              LENA Digital House
              <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" />
            </a>
          ) : (
            <span className="font-semibold text-muted-foreground">LENA Digital House</span>
          )}
        </p>
      </section>
    </main>
  );
}
