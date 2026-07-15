import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';

export function LoginPage() {
  const { login } = useAuth();
  const envDiagnostics = getEnvDiagnostics();
  const runtimeError = envDiagnostics[0]?.messageAr ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (runtimeError) return;

    setFormError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast.success('تم تسجيل الدخول بنجاح');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="w-full max-w-md overflow-hidden rounded-xl border border-border/70 bg-card shadow-elevated"
      data-login-surface
    >
      <div className="p-5 sm:p-8">
        {/* Brand Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              R
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">Rentrix</p>
              <p className="text-xs font-medium text-muted-foreground">إدارة عقارية بوضوح وسرعة</p>
            </div>
          </div>

          <div className="mt-5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              دخول آمن لمساحة العمل
            </span>
            <h1 className="mt-3 text-2xl font-bold leading-tight">مرحباً بعودتك</h1>
            <p className="mt-1.5 text-xs font-normal leading-relaxed text-muted-foreground">
              أدخل بيانات حسابك للانتقال مباشرة إلى مساحة العمل.
            </p>
          </div>
        </header>

        {/* Login Form */}
        <form
          className="space-y-4"
          onSubmit={handleSubmit}
          aria-describedby={formError || runtimeError ? 'login-error' : undefined}
        >
          {/* Email field */}
          <div className="grid gap-1.5">
            <label htmlFor="login-email" className="text-xs font-medium text-foreground">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="login-email"
                className="pe-10 text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
                required
                autoComplete="email"
                dir="ltr"
                placeholder="name@example.com"
                disabled={isSubmitting || Boolean(runtimeError)}
              />
            </div>
          </div>

          {/* Password field */}
          <div className="grid gap-1.5">
            <label htmlFor="login-password" className="text-xs font-medium text-foreground">
              كلمة المرور
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="login-password"
                className="ps-10 pe-12 text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
                required
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                disabled={isSubmitting || Boolean(runtimeError)}
              />
              <button
                type="button"
                className="absolute left-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                onClick={() => setIsPasswordVisible((v) => !v)}
                aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                disabled={isSubmitting || Boolean(runtimeError)}
              >
                {isPasswordVisible
                  ? <EyeOff className="size-4" aria-hidden="true" />
                  : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Inline error */}
          {runtimeError || formError ? (
            <div
              id="login-error"
              className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/5 p-3 text-danger"
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold">
                  {runtimeError ? 'يتعذر إكمال تسجيل الدخول بسبب إعدادات تشغيل ناقصة' : 'تعذر تسجيل الدخول'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-danger/90">
                  {runtimeError ?? formError}
                </p>
              </div>
            </div>
          ) : null}

          {/* Submit Action */}
          <Button
            className="mt-2 h-11 w-full gap-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/20"
            type="submit"
            disabled={isSubmitting || Boolean(runtimeError)}
          >
            {isSubmitting ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                جارٍ تسجيل الدخول...
              </>
            ) : (
              <>
                تسجيل الدخول
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>

        {/* Security footer note */}
        <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/40 p-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-success/10 text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">جلسة عمل محمية</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              بيانات الدخول تستخدم للوصول إلى حسابك فقط، وتظل جلسة العمل محفوظة على جهازك.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
