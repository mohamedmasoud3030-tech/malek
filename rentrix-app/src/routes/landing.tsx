import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  DoorOpen,
  FileText,
  Globe,
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Wrench,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Feature = Readonly<{
  icon: typeof Building2;
  title: string;
  description: string;
  accent: string;
}>;

const features: Feature[] = [
  {
    icon: Building2,
    title: 'إدارة العقارات',
    description: 'سجّل العقارات ومواصفاتها ومالكيها وراقب حالتها وأداءها من مكان واحد.',
    accent: 'from-sky-500/15 to-sky-500/5 text-sky-600',
  },
  {
    icon: DoorOpen,
    title: 'الوحدات',
    description: 'تابع الوحدات وحالتها (مشغولة/شاغرة) واربطها بعقاراتها بسهولة ووضوح.',
    accent: 'from-violet-500/15 to-violet-500/5 text-violet-600',
  },
  {
    icon: FileText,
    title: 'العقود',
    description: 'أنشئ عقود الإيجار وتابع تواريخها وحالاتها وتجديداتها آلياً.',
    accent: 'from-amber-500/15 to-amber-500/5 text-amber-600',
  },
  {
    icon: WalletCards,
    title: 'المالية',
    description: 'فواتير وتحصيلات ومصروفات وكشوف حساب مع تقارير مالية دقيقة وقابلة للتدقيق.',
    accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  },
  {
    icon: Wrench,
    title: 'الصيانة',
    description: 'إدارة طلبات الصيانة والمتابعة العاجلة لراحة المستأجرين واستقرار العقار.',
    accent: 'from-rose-500/15 to-rose-500/5 text-rose-600',
  },
  {
    icon: BarChart3,
    title: 'التقارير',
    description: 'مركز تقارير شامل للتحصيلات والمتأخرات والإشغال والمحاسبة في لوحة واحدة.',
    accent: 'from-cyan-500/15 to-cyan-500/5 text-cyan-600',
  },
];

const whyItems: Feature[] = [
  {
    icon: Globe,
    title: 'عربي RTL أصيل',
    description: 'واجهة عربية أصلية تدعم الاتجاه من اليمين لليسار في كل التفاصيل.',
    accent: 'from-primary/15 to-primary/5 text-primary',
  },
  {
    icon: Lock,
    title: 'آمن وموثوق',
    description: 'صلاحات دقيقة وجلسات آمنة لحماية بيانات عقاراتك ومالكيك.',
    accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  },
  {
    icon: Sparkles,
    title: 'مالي دقيق',
    description: 'حسابات وتقارير مالية متوازنة وقابلة للتدقيق لقرارات واثقة.',
    accent: 'from-violet-500/15 to-violet-500/5 text-violet-600',
  },
];

function BrandMark({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        'relative grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-gradient-to-br from-white to-cyan-100 text-lg font-black text-slate-950 shadow-[0_12px_32px_-12px_rgba(34,211,238,0.8)]',
        className,
      )}
      aria-hidden="true"
    >
      R
      <span className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-sidebar bg-emerald-400" />
    </div>
  );
}

/** Decorative, dependency-free mock of the in-app workspace (stands in for a real screenshot). */
function AppPreview() {
  const bars = [42, 68, 55, 80, 63, 90, 74];
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <span className="size-3 rounded-full bg-rose-400/70" />
        <span className="size-3 rounded-full bg-amber-400/70" />
        <span className="size-3 rounded-full bg-emerald-400/70" />
        <div className="mx-auto rounded-full bg-background px-3 py-1 text-[11px] font-bold text-muted-foreground">
          app.rentrix.com
        </div>
      </div>
      <div className="flex">
        <aside className="hidden w-44 shrink-0 flex-col gap-1.5 border-l border-border/60 bg-[linear-gradient(165deg,hsl(var(--sidebar)),hsl(var(--sidebar-accent))_145%)] p-4 sm:flex">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-white/10 text-sm font-black">R</div>
            <span className="text-sm font-black text-white">Rentrix</span>
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
        </aside>
        <main className="flex-1 space-y-3 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: 'الفواتير', v: '48K' },
              { l: 'المحصّل', v: '39K' },
              { l: 'المستحق', v: '9K' },
              { l: 'المصروفات', v: '12K' },
            ].map((kpi) => (
              <div key={kpi.l} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="text-[11px] font-bold text-slate-400">{kpi.l}</p>
                <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{kpi.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <p className="mb-3 text-xs font-black text-slate-500">نظرة عامة على التحصيل</p>
            <div className="flex h-24 items-end justify-between gap-2">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="w-full rounded-t-md bg-gradient-to-t from-primary/70 to-primary/30"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
            <p className="text-xs font-black text-slate-500">أحدث العقود</p>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="font-bold text-slate-700">برج النخيل · وحدة 10{row + 1}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">نشط</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a href="#top" className="flex items-center gap-3">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-lg font-black tracking-tight">Rentrix</p>
            <p className="text-[11px] font-bold text-muted-foreground">نظام إدارة العقارات</p>
          </div>
        </a>
        <nav className="hidden items-center gap-7 text-sm font-bold text-muted-foreground md:flex">
          <a href="#features" className="transition hover:text-foreground">المزايا</a>
          <a href="#showcase" className="transition hover:text-foreground">كيف يعمل</a>
          <a href="#why" className="transition hover:text-foreground">لماذا Rentrix</a>
        </nav>
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
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-white to-slate-50" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 size-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-bold text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          منصة عربية متكاملة لإدارة العقارات
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black leading-[1.15] tracking-tight sm:text-6xl">
          نظام <span className="bg-gradient-to-l from-primary to-cyan-500 bg-clip-text text-transparent">Rentrix</span> لإدارة عقاراتك
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-bold leading-7 text-muted-foreground sm:text-lg">
          منصة واحدة تجمع العقارات والوحدات والعقود والمالية والصيانة والتقارير —
          تبدأ بإضافة عقارك الأول خلال دقائق، بواجهة عربية أصلية وتقارير مالية دقيقة.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" /> عربي RTL بالكامل
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" /> تقارير مالية دقيقة
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-4 text-emerald-500" /> صلاحيات آمنة
          </span>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <AppPreview />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-black uppercase tracking-widest text-primary">المزايا</span>
        <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">كل ما تحتاجه في مكان واحد</h2>
        <p className="mt-3 text-sm font-bold leading-6 text-muted-foreground">
          وحدات متكاملة تغطي دورة حياة العقار من التسجيل حتى التحصيل والتقارير.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card
              key={feature.title}
              className="hover-card transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <CardContent className="p-6">
                <div className={cn('mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br', feature.accent)}>
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-black">{feature.title}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Showcase() {
  const points = [
    'لوحة تحكم بصرية بمؤشرات أداء العقارات والتحصيل والمتأخرات.',
    'مركز تقارير يجمع التحصيلات والمتأخرات والإشغال والمحاسبة.',
    'فواتير وتحصيلات ومصروفات مع كشوف حساب قابلة للتصدير.',
  ];
  return (
    <section id="showcase" className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-primary">كيف يعمل</span>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">مساحة عمل واحدة لكل عملياتك العقارية</h2>
          <p className="mt-3 text-sm font-bold leading-6 text-muted-foreground">
            من لوحة التحكم إلى التقارير، كل شاشة مبنية لتكون واضحة وسريعة على الجوال والحاسوب.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden="true" />
                <span className="text-sm font-bold leading-6 text-foreground">{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <Button asChild variant="outline">
              <Link to="/login">
                جرّب المساحة الآن
                <ArrowLeft className="me-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="order-first lg:order-last">
          <AppPreview />
        </div>
      </div>
    </section>
  );
}

function WhyRentrix() {
  return (
    <section id="why" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-black uppercase tracking-widest text-primary">لماذا Rentrix</span>
        <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">مبني للمنطقة العربية</h2>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {whyItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-3xl border border-border/60 bg-card p-6">
              <div className={cn('mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br', item.accent)}>
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-center text-white sm:p-14">
        <div className="pointer-events-none absolute -left-10 -top-10 size-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-10 size-52 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative">
          <LayoutDashboard className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-3xl font-black sm:text-4xl">ابدأ بإدارة عقاراتك اليوم</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-6 text-slate-300">
            سجّل الدخول وأضف أول عقار وعقد خلال دقائق — كل ما تحتاجه في مساحة عمل واحدة.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
              <Link to="/login">
                تسجيل الدخول
                <ArrowLeft className="me-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const columns: ReadonlyArray<{ title: string; links: ReadonlyArray<string> }> = [
    { title: 'المنتج', links: ['العقارات', 'العقود', 'المالية', 'التقارير'] },
    { title: 'الشركة', links: ['من نحن', 'الدعم', 'الأسعار', 'السياسة'] },
    { title: 'القانوني', links: ['الخصوصية', 'الشروط', 'الأمان'] },
  ];
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-lg font-black tracking-tight">Rentrix</span>
          </div>
          <p className="mt-3 max-w-xs text-sm font-bold leading-6 text-muted-foreground">
            نظام عربي متكامل لإدارة العقارات والوحدات والعقود والمالية في مساحة عمل واحدة.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-emerald-600">
            <ShieldCheck className="size-4" /> منصة آمنة وموثوقة
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-black">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#top" className="text-sm font-bold text-muted-foreground transition hover:text-foreground">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs font-bold text-muted-foreground sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} Rentrix — نظام إدارة العقارات. جميع الحقوق محفوظة.</span>
          <span>صُنع بكل اهتمام للمنطقة العربية</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingRouteComponent() {
  return (
    <PageLayout dir="rtl" lang="ar" size="full" contentClassName="space-y-0" className="bg-background text-foreground">
      <NavBar />
      <Hero />
      <Features />
      <Showcase />
      <WhyRentrix />
      <CtaSection />
      <Footer />
    </PageLayout>
  );
}
