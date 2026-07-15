import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  DoorOpen,
  FileText,
  ShieldCheck,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Feature = Readonly<{
  icon: typeof Building2;
  title: string;
  description: string;
}>;

const features: Feature[] = [
  {
    icon: Building2,
    title: 'إدارة العقارات',
    description: 'سجّل العقارات ومواصفاتها ومالكيها وراقب حالتها من مكان واحد.',
  },
  {
    icon: DoorOpen,
    title: 'الوحدات',
    description: 'تابع الوحدات وحالتها (مشغولة/شاغرة) واربطها بعقاراتها بسهولة.',
  },
  {
    icon: FileText,
    title: 'العقود',
    description: 'أنشئ عقود الإيجار وتابع تواريخها وحالاتها وتجديداتها.',
  },
  {
    icon: WalletCards,
    title: 'المالية',
    description: 'فواتير وتحصيلات ومصروفات وكشوف حساب مع تقارير مالية دقيقة.',
  },
  {
    icon: Wrench,
    title: 'الصيانة',
    description: 'إدارة طلبات الصيانة والمتابعة العاجلة لراحة المستأجرين.',
  },
  {
    icon: BarChart3,
    title: 'التقارير',
    description: 'مركز تقارير شامل للتحصيلات والمتأخرات والإشغال والمحاسبة.',
  },
];

function BrandMark() {
  return (
    <div
      className="grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-gradient-to-br from-white to-cyan-100 text-lg font-black text-slate-950 shadow-[0_12px_32px_-12px_rgba(34,211,238,0.8)]"
      aria-hidden="true"
    >
      R
      <span className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-sidebar bg-emerald-400" />
    </div>
  );
}

/** Decorative, dependency-free mock of the in-app workspace (stands in for a real screenshot). */
function MockAppPreview() {
  return (
    <div
      className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(165deg,hsl(var(--sidebar)),hsl(var(--sidebar-accent))_145%)] text-sidebar-foreground shadow-2xl"
      aria-hidden="true"
    >
      <div className="flex">
        <div className="hidden w-44 shrink-0 flex-col gap-2 border-l border-white/10 p-4 sm:flex">
          <div className="mb-2 flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-white/10 text-sm font-black">R</div>
            <span className="text-sm font-black">Rentrix</span>
          </div>
          {['لوحة التحكم', 'العقارات', 'العقود', 'المالية', 'التقارير'].map((item, i) => (
            <div
              key={item}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-bold',
                i === 0 ? 'bg-white/15 text-white' : 'bg-white/5 text-sidebar-foreground/70',
              )}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 space-y-3 bg-slate-50 p-4 text-slate-800">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'الفواتير', value: '48K' },
              { label: 'المحصل', value: '39K' },
              { label: 'المستحق', value: '9K' },
              { label: 'المصروفات', value: '12K' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-black tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <p className="mb-2 text-xs font-black text-slate-500">أحدث العقود</p>
            <div className="space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-bold">برج النخيل · وحدة 10{row + 1}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">نشط</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingRouteComponent() {
  return (
    <PageLayout dir="rtl" lang="ar" size="full" className="bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-lg font-black tracking-tight">Rentrix</p>
              <p className="text-[11px] font-bold text-muted-foreground">نظام إدارة العقارات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login">ابدأ الآن</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-10 -top-10 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-bold text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            مساحة عمل عقارية آمنة بالكامل
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            نظام Rentrix لإدارة العقارات
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-bold leading-7 text-muted-foreground sm:text-lg">
            منصة عربية متكاملة لإدارة العقارات والوحدات والعقود والمالية والصيانة والتقارير —
            كل ما تحتاجه لإدارة محفظتك العقارية في مساحة عمل واحدة.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                ابدأ الآن
                <ArrowLeft className="me-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">تسجيل الدخول</Link>
            </Button>
          </div>
          <div className="mt-12">
            <MockAppPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">كل ما تحتاجه في مكان واحد</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-muted-foreground">
            وحدات متكاملة تغطي دورة حياة العقار من التسجيل حتى التحصيل والتقارير.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} variant="default" className="hover-card">
                <CardHeader>
                  <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-bold leading-6 text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Why Rentrix */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <Card variant="muted" className="p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { title: 'عربي RTL بالكامل', desc: 'واجهة عربية أصلية تدعم الاتجاه من اليمين لليسار.' },
              { title: 'مالي دقيق', desc: 'حسابات وتقارير مالية متوازنة وقابلة للتدقيق.' },
              { title: 'سريع ومرن', desc: 'تنقّل سلس بين العقارات والعقود والتقارير.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                <div>
                  <p className="font-black">{item.title}</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-center text-white sm:p-12">
          <h2 className="text-2xl font-black sm:text-3xl">ابدأ بإدارة عقاراتك اليوم</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-6 text-slate-300">
            سجّل الدخول وابدأ بإضافة أول عقار وعقد خلال دقائق.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
              <Link to="/login">
                تسجيل الدخول
                <ArrowLeft className="me-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm font-bold text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <BrandMark />
            <span>© {new Date().getFullYear()} Rentrix — نظام إدارة العقارات</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground">تسجيل الدخول</Link>
            <span className="text-muted-foreground/60">الإصدار 1.0</span>
          </div>
        </div>
      </footer>
    </PageLayout>
  );
}
