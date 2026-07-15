import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandMark } from './BrandMark';
import { AppPreview } from './AppPreview';

export function LandingHero() {
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
          نظام <span className="bg-gradient-to-l from-primary to-cyan-500 bg-clip-text text-transparent">Rentrix</span>{' '}
          لإدارة عقاراتك
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base font-bold leading-7 text-muted-foreground sm:text-lg">
          منصة واحدة تجمع العقارات والوحدات والعقود والمالية والصيانة والتقارير — تبدأ بإضافة
          عقارك الأول خلال دقائق، بواجهة عربية أصلية وتقارير مالية دقيقة.
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
