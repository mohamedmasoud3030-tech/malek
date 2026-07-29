import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { MalikBrand } from '@/components/brand/malik-brand';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';
import { SUPPORT_CONTACTS } from '@/lib/contact';
import { CommandCenterPanel } from './command-center-panel';

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
        setFormError(error instanceof Error ? error.message : 'تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى.');
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
      {/* ── Visual Panel (Desktop 60%) ──── */}
      <div className="hidden md:flex md:w-[60%] md:shrink-0 lg:w-[62%]">
        <CommandCenterPanel />
      </div>

      {/* ── Form Panel (Desktop 40%) ──── */}
      <div className="flex min-h-dvh flex-1 flex-col px-4 py-8 sm:px-6 lg:px-10 overflow-y-auto">
        <div className="safe-top-app safe-bottom-overlay mx-auto w-full max-w-sm flex flex-1 flex-col justify-center">
          {/* Logo & Tagline (Mobile: closer to form, Desktop: larger) */}
          <header className="mb-8 text-center md:text-right">
            <MalikBrand
              showTagline
              className="inline-flex scale-110 md:scale-125 origin-center md:origin-right"
            />
          </header>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              تسجيل الدخول
            </h1>
          </div>

          {/* ── Login Form ──── */}
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
                  className="pe-10 h-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
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
                  className="ps-10 pe-10 h-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
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
                  onClick={() => setIsPasswordVisible((v) => !v)}
                  aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  disabled={isSubmitting || Boolean(runtimeError)}
                >
                  {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {isCapsLock && (
                <p id="caps-lock-warning" className="flex items-center gap-1.5 text-xs text-warning" role="status">
                  <AlertTriangle className="size-3.5" />
                  مفتاح Caps Lock مفعّل
                </p>
              )}
            </div>

            {hasFieldError && (
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
            )}

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

          {/* ── Contact Info ──── */}
          <footer className="mt-10">
            {/* Mobile Contact Card */}
            <div className="md:hidden rounded-xl border border-border/60 bg-muted/30 p-5 space-y-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Phone className="size-4 text-primary" />
                تحتاج مساعدة؟ تواصل معنا
              </h2>
              <div className="grid gap-3">
                <ContactLink
                  icon={<Phone className="size-3.5" />}
                  label={SUPPORT_CONTACTS.oman.label}
                  value={SUPPORT_CONTACTS.oman.number}
                  href={SUPPORT_CONTACTS.oman.whatsappUrl}
                />
                <ContactLink
                  icon={<Phone className="size-3.5" />}
                  label={SUPPORT_CONTACTS.egypt.label}
                  value={SUPPORT_CONTACTS.egypt.number}
                  href={SUPPORT_CONTACTS.egypt.whatsappUrl}
                />
                <ContactLink
                  icon={<Phone className="size-3.5" />}
                  label={SUPPORT_CONTACTS.saudi.label}
                  value={SUPPORT_CONTACTS.saudi.number}
                  href={SUPPORT_CONTACTS.saudi.whatsappUrl}
                />
                {SUPPORT_CONTACTS.emails.map((email, idx) => (
                  <ContactLink
                    key={idx}
                    icon={<Mail className="size-3.5" />}
                    label={email.label}
                    value={email.address}
                    href={`mailto:${email.address}`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop Contact Section */}
            <div className="hidden md:block">
              <div className="flex flex-col gap-4 pt-8 border-t border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  قنوات التواصل والدعم
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <div className="space-y-2">
                    <DesktopContactItem
                      label={SUPPORT_CONTACTS.oman.label}
                      value={SUPPORT_CONTACTS.oman.number}
                      href={SUPPORT_CONTACTS.oman.whatsappUrl}
                    />
                    <DesktopContactItem
                      label={SUPPORT_CONTACTS.egypt.label}
                      value={SUPPORT_CONTACTS.egypt.number}
                      href={SUPPORT_CONTACTS.egypt.whatsappUrl}
                    />
                    <DesktopContactItem
                      label={SUPPORT_CONTACTS.saudi.label}
                      value={SUPPORT_CONTACTS.saudi.number}
                      href={SUPPORT_CONTACTS.saudi.whatsappUrl}
                    />
                  </div>
                  <div className="space-y-2">
                    {SUPPORT_CONTACTS.emails.map((email, idx) => (
                      <DesktopContactItem
                        key={idx}
                        label={email.label}
                        value={email.address}
                        href={`mailto:${email.address}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function DesktopContactItem({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <a
      href={href}
      className="group flex flex-col items-start gap-0.5"
    >
      <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">{label}</span>
      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors" dir="ltr">{value}</span>
    </a>
  );
}

function ContactLink({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between group rounded-lg bg-card px-3 py-2.5 shadow-sm border border-border/40 hover:border-primary/30 transition-all active:scale-[0.98]"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground group-hover:text-primary transition-colors">
          {icon}
        </span>
        <span className="text-xs font-medium text-foreground">{label}</span>
      </div>
      <span className="text-xs font-bold text-primary" dir="ltr">
        {value}
      </span>
    </a>
  );
}
