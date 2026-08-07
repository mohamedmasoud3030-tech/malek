import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_MARK_ASSET, APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';
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
    <main
      className="grid min-h-screen min-h-dvh w-full place-items-center bg-background px-5 py-8 sm:px-6 sm:py-10 lg:px-8"
      data-login-surface
      dir="rtl"
    >
      <section
        className="safe-top-app safe-bottom-overlay flex w-full max-w-[25rem] flex-col items-stretch"
        data-login-main
      >
        <header className="mb-7 flex flex-col items-center text-center sm:mb-8" data-login-brand>
          <img
            src={APP_BRAND_MARK_ASSET}
            alt=""
            aria-hidden="true"
            className="size-16 object-contain sm:size-[4.5rem] lg:size-20"
            data-malek-canonical-mark
          />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-[1.75rem]">
            {APP_BRAND_NAME}
          </h1>
          <p
            className="mt-1.5 text-sm font-medium leading-6 text-muted-foreground sm:text-[0.95rem]"
            data-login-tagline
          >
            {APP_BRAND_TAGLINE_AR}
          </p>
        </header>

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
                inputMode="email"
                dir="ltr"
                placeholder="name@malek.com"
                disabled={isSubmitting || Boolean(runtimeError)}
                aria-invalid={hasFieldError || undefined}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label htmlFor="login-password" className="text-sm font-semibold text-foreground">
              كلمة المرور
            </label>
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
                className="absolute inset-y-0 left-1 my-auto grid size-11 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
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
              <div className="text-xs leading-relaxed">{runtimeError ?? formError}</div>
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

        <footer
          className="mt-7 border-t border-border/60 pt-5 text-center"
          data-contact-footer
          aria-label="بيانات الدعم والتواصل"
        >
          <p className="mb-3 text-xs font-semibold text-muted-foreground">تحتاج مساعدة؟ تواصل معنا</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[SUPPORT_CONTACTS.oman, SUPPORT_CONTACTS.egypt, SUPPORT_CONTACTS.saudi].map((contact) => (
              <a
                key={contact.number}
                href={contact.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={`${contact.label} ${contact.number}`}
              >
                <MessageCircle className="size-3.5" aria-hidden="true" />
                <span dir="ltr">{contact.number}</span>
              </a>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {SUPPORT_CONTACTS.emails.map((contact) => (
              <a
                key={contact.address}
                href={`mailto:${contact.address}`}
                className="inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Mail className="size-3.5" aria-hidden="true" />
                <span dir="ltr">{contact.address}</span>
              </a>
            ))}
          </div>
        </footer>
      </section>
    </main>
  );
}
