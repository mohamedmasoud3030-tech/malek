import { Globe, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LandingFeature } from '../types';

const whyItems: LandingFeature[] = [
  {
    icon: Globe,
    title: 'عربي RTL أصيل',
    description: 'واجهة عربية أصلية تدعم الاتجاه من اليمين لليسار في كل التفاصيل.',
    accent: 'from-primary/15 to-primary/5 text-primary',
  },
  {
    icon: Lock,
    title: 'آمن وموثوق',
    description: 'صلاحيات دقيقة وجلسات آمنة لحماية بيانات عقاراتك ومالكيك.',
    accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600',
  },
  {
    icon: Sparkles,
    title: 'مالي دقيق',
    description: 'حسابات وتقارير مالية متوازنة وقابلة للتدقيق لقرارات واثقة.',
    accent: 'from-violet-500/15 to-violet-500/5 text-violet-600',
  },
];

export function WhyRentrixSection() {
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
