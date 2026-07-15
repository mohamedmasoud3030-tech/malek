import { Link } from '@tanstack/react-router';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CtaSection() {
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
