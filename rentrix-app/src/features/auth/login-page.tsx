import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { MalikBrand } from '@/components/brand/malik-brand';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';
import { SUPPORT_CONTACTS } from '@/lib/contact';
import { CommandCenterPanel } from './command-center-panel';
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

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
    },
    [email, login, password, runtimeError],
  );

  const handlePasswordKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.currentTarget.form?.requestSubmit();
      }
    },
    [],
  );

  const handleCapsLockDetect = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (typeof event.getModifierState === 'function') {
        setIsCapsLock(event.getModifierState('CapsLock'));
      }
    },
    [],
  );

  return (
    <div
      className="flex min-h-screen min-h-dvh w-full flex-col md:min-h-0 md:flex-row"
      data-login-surface
      dir="rtl"
    >
      <div className="hidden md:flex md:w-[60%] md:shrink-0 lg:w-[62%]">
        <CommandCenterPanel />
      </div>

      <div className="flex min-h-dvh flex-1 flex-col overflow-y-auto px-4 sm:px-6 lg:px-10">
        <div className="safe-top-app safe-bottom-overlay mx-auto flex min-h-dvh w-full max-w-sm flex-1 flex-col py-5 sm:py-7 md:min-h-0 md:py-8">
          <section className="flex flex-1 flex-col justify-center py-6 sm:py-8" data-login-main>
            <header className="mb-7 text-center" data-login-brand>
              <MalikBrand
                showTagline
                className="inline-flex flex-col items-center gap-3 text-center"
                markClassName="size-20 sm:size-24"
                wordmarkClassName="text-3xl tracking-[0.18em] sm:text-4xl"
              />
            </header>

            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                تسجيل الدخول
              </h1>
            </div>

            <form
              className="space-y-5"
              onSubmit={handleSubmit}
              noValidate={false}
              aria-describedby={hasFieldError ? 'login-error' : undefined}
            >
              <div className="grid gap-2">
                <label htmlFor="login-email" className="text-sm font-semibold text-foreground">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="login-email"
                    className="h-12 pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFormError(null);
                    }}
                    required
                    autoComplete="email"
                    dir="ltr"
                    placeholder="name@malik.com"
                    disabled={isSubmitting || Boolean(runtimeError)}
                    aria-invalid={hasFieldError || undefined}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-sm font-semibold text-foreground">
                    كلمة المرور
                  </label>
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="login-password"
                    className="h-12 ps-10 pe-10 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFormError(null);
                    }}
                    onKeyDown={handlePasswordKeyDown}
                    onKeyUp={handleCapsLockDetect}
                    required
                    autoComplete="current-password"
                    dir="ltr"
                    placeholder="••••••••"
                    disabled={isSubmitting || Boolean(runtimeError)}
                    aria-invalid={hasFieldError || undefined}
                    aria-describedby={isCapsLock ? 'caps-lock-warning' : undefined}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 left-1 my-auto grid size-10 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                    aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    disabled={isSubmitting || Boolean(runtimeError)}
                  >
                    {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {isCapsLock ? (
                  <p id="caps-lock-warning" className="flex items-center gap-1.5 text-xs text-warning" role="status">
                    <AlertTriangle className="size-3.5" />
                    مفتاح Caps Lock مفعّل
                  </p>
                ) : null}
              </div>

              {hasFieldError ? (
                <div
                  id="login-error"
                  className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/5 p-3 text-danger"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    {runtimeError ?? formError}
                  </div>
                </div>
              ) : null}

              <Button
                className="h-12 w-full gap-2 text-base font-bold shadow-sm transition-all active:scale-[0.98] md:text-sm"
                type="submit"
                disabled={isSubmitting || Boolean(runtimeError)}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    جارٍ التحقق...
                  </>
                ) : (
                  <>
                    تسجيل الدخول
                    <ArrowLeft className="size-4 rtl:rotate-180" />
                  </>
                )}
              </Button>
            </form>
          </section>

          <footer
            className="shrink-0 border-t border-border/40 pt-3 text-center text-[9.5px] leading-4 text-muted-foreground/70"
            data-contact-footer
            aria-label="بيانات الدعم والتواصل"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
              <span>الدعم:</span>
              <span dir="ltr">{SUPPORT_CONTACTS.oman.number}</span>
              <span aria-hidden="true">·</span>
              <span dir="ltr">{SUPPORT_CONTACTS.egypt.number}</span>
              <span aria-hidden="true">·</span>
              <span dir="ltr">{SUPPORT_CONTACTS.saudi.number}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5" dir="ltr">
              {SUPPORT_CONTACTS.emails.map((contact, index) => (
                <span key={contact.address}>
                  {index > 0 ? <span className="me-2" aria-hidden="true">·</span> : null}
                  {contact.address}
                </span>
              ))}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
