import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getEnvDiagnostics } from '@/lib/runtime-diagnostics';

const highlights = [
  { icon: Building2, title: 'إدارة واضحة للأصول', description: 'العقارات والوحدات والعقود في مساحة عمل واحدة.' },
  { icon: WalletCards, title: 'متابعة مالية أسرع', description: 'الفواتير والتحصيل والمتأخرات دون تشتيت.' },
  { icon: BarChart3, title: 'قرارات أدق', description: 'نظرة تشغيلية تساعدك على معرفة ما يحتاج انتباهك.' },
] as const;

export function LoginPage() {
  const { login } = useAuth();
  const envDiagnostics = getEnvDiagnostics();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast.success('تم تسجيل الدخول بنجاح');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر تسجيل الدخول. راجع البيانات وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="animate-panel-in grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[hsl(var(--card)/0.96)] shadow-[0_30px_90px_-45px_rgba(15,23,42,0.7)] backdrop-blur-2xl lg:grid-cols-[1.08fr_0.92fr]">
      <aside aria-hidden="true" className="auth-grid relative hidden min-h-[650px] overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
        <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 size-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="animate-float-soft pointer-events-none absolute left-16 top-28 grid size-16 place-items-center rounded-[1.4rem] border border-white/10 bg-white/[0.08] text-accent shadow-xl backdrop-blur">
          <Sparkles className="size-7" aria-hidden="true" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="relative grid size-14 place-items-center rounded-[1.2rem] bg-white text-xl font-black text-slate-950 shadow-xl shadow-black/10">
              R
              <span className="absolute -bottom-1 -left-1 size-4 rounded-full border-[3px] border-sidebar bg-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight">Rentrix</p>
              <p className="mt-1 text-xs font-bold text-white/60">إدارة عقارية بوضوح وسرعة</p>
            </div>
          </div>

          <div className="mt-16 max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-black text-accent">
              <ShieldCheck className="size-4" />
              مساحة تشغيل مصممة لليوم العملي
            </span>
            <h2 className="mt-5 text-4xl font-black leading-[1.35] tracking-tight xl:text-5xl">
              كل ما تحتاجه لإدارة عقاراتك
              <span className="mt-1 block text-accent">في واجهة واحدة هادئة وواضحة.</span>
            </h2>
            <p className="mt-5 max-w-lg text-sm font-bold leading-7 text-white/60">
              ادخل إلى مساحة عملك وتابع العقارات والعقود والتحصيل والتشغيل بخطوات أسرع وتركيز أكبر.
            </p>
          </div>
        </div>

        <div className="relative grid gap-3">
          {highlights.map((highlight) => {
            const Icon = highlight.icon;
            return (
              <div key={highlight.title} className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.1]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent transition group-hover:scale-105">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-black">{highlight.title}</p>
                  <p className="mt-1 text-[11px] font-bold leading-5 text-white/55">{highlight.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="relative flex min-h-[620px] items-center p-5 sm:p-8 lg:p-10 xl:p-12">
        <div className="pointer-events-none absolute left-4 top-4 size-24 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-md">
          <div className="mb-9 lg:hidden">
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
          </div>

          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-black text-primary">
              <LockKeyhole className="size-4" />
              دخول آمن لمساحة العمل
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">مرحباً بعودتك</h1>
            <p className="mt-2 text-sm font-bold leading-6 text-muted-foreground">
              سجل الدخول للمتابعة من حيث توقفت وإدارة يومك من لوحة واحدة.
            </p>
          </div>

          {envDiagnostics.length > 0 ? (
            <Card className="mb-5 border-destructive/40 bg-destructive/5" role="alert" aria-live="assertive">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <AlertTriangle className="size-4" />
                  يتعذر إكمال تسجيل الدخول بسبب إعدادات تشغيل ناقصة
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-destructive/90">
                  {envDiagnostics[0]?.messageAr}
                </CardDescription>
                <CardDescription className="text-xs leading-5 text-destructive/80">
                  يلزم ضبط إعدادات Supabase في بيئة النشر ثم إعادة تحميل الصفحة.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-black text-foreground">
              البريد الإلكتروني
              <span className="relative">
                <Mail className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 rounded-2xl bg-[hsl(var(--background)/0.7)] pe-11"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  dir="ltr"
                  placeholder="name@example.com"
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
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  dir="ltr"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="pressable absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => setIsPasswordVisible((isVisible) => !isVisible)}
                  aria-label={isPasswordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {isPasswordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            <Button className="mt-2 h-12 w-full gap-2 rounded-2xl text-sm" type="submit" disabled={isSubmitting}>
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

          <p className="mt-8 text-center text-[11px] font-bold text-muted-foreground">
            Rentrix · مساحة تشغيل عقارية مصممة للتركيز والإنجاز
          </p>
        </div>
      </div>
    </section>
  );
}
