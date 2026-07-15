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
      className="animate-panel-in w-full max-w-md overflow-hidden rounded-[2rem] border border-border/70 bg-[hsl(var(--card)/0.96)] shadow-[0_30px_90px_-45px_rgba(15,23,42,0.7)] backdrop-blur-2xl"
      data-login-surface
    >
      <div className="p-5 sm:p-8 lg:p-10">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="relative grid size-12 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-lg">
              R
              <span className="absolute -bottom-1 -left-1 size-3.5 rounded-full border-2 border-[hsl(var(--card))] bg-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-black">Rentrix</p>
              <p className="text-xs font-bold text-muted-foreground">إدارة عقارية بوضوح وسرعة</p>
            </div>
          </div>

          <div className="mt-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
              <LockKeyhole className="size-4" />
              دخول آمن لمساحة العمل
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">مرحباً بعودتك</h1>
            <p className="mt-2 text-sm font-bold leading-6 text-muted-foreground">
              أدخل بيانات حسابك للانتقال مباشرة إلى مساحة العمل.
            </p>
          </div>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit} aria-describedby={formError || runtimeError ? 'login-error' : undefined}>
          <label className="grid gap-2 text-sm font-black text-foreground">
            البريد الإلكتروني
            <span className="relative">
              <Mail className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 rounded-2xl bg-[hsl(var(--background)/0.7)] pe-11"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFormError(null);
                }}
                required
                autoComplete="email"
                dir="ltr"
                placeholder="name@example.com"
                disabled={isSubmitting || Boolean(runtimeError)}
              />
            </span>
          </label>

          <label className="grid gap-2 text-sm font-black text-foreground">
            كلمة المرور
            <span className="relative">
              <LockKeyhole className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 rounded-2xl bg-[hsl(var(--background)/0.7)] px-11"
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError(null);
                }}
                required
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                disabled={isSubmitting || Boolean(runtimeError)}
              />
              <button
                type="button"
                className="pressable absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
                aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                disabled={isSubmitting}
              >
                {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          {runtimeError || formError ? (
            <div
              id="login-error"
              className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3.5 text-destructive"
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-xs font-black">
                  {runtimeError ? 'يتعذر إكمال تسجيل الدخول بسبب إعدادات تشغيل ناقصة' : 'تعذر تسجيل الدخول'}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-destructive/90">
                  {runtimeError ?? formError}
                </p>
              </div>
            </div>
          ) : null}

          <Button className="h-12 w-full gap-2 rounded-2xl text-sm" type="submit" disabled={isSubmitting || Boolean(runtimeError)}>
            {isSubmitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
            <ArrowLeft className="size-4" />
          </Button>
        </form>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-muted/55 p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="size-4" />
          </span>
          <div>
            <p className="text-xs font-black text-foreground">جلسة عمل محمية</p>
            <p className="mt-1 text-[11px] font-bold leading-5 text-muted-foreground">
              بيانات الدخول تستخدم للوصول إلى حسابك فقط، وتظل جلسة العمل محفوظة على جهازك.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
