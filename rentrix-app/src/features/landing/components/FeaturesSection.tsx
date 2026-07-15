import { Building2, DoorOpen, FileText, WalletCards, Wrench, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LandingFeature } from '../types';

const features: LandingFeature[] = [
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

export function FeaturesSection() {
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
