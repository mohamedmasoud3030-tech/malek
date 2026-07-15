import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, ClipboardList, FileBarChart, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductScreenshot } from './ProductScreenshot';

type ShowcaseTab = {
  id: string;
  label: string;
  icon: typeof FileBarChart;
  src: string;
  alt: string;
  caption: string;
};

const tabs: ShowcaseTab[] = [
  {
    id: 'reports',
    label: 'مركز التقارير',
    icon: FileBarChart,
    src: '/landing/workspace.png',
    alt: 'مركز التقارير والكشوف في Rentrix',
    caption: 'تحصيلات ومتأخرات وإشغال ومحاسبة مع كشوف حساب قابلة للتصدير.',
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    icon: Settings2,
    src: '/landing/settings.png',
    alt: 'شاشة إعدادات الشركة في Rentrix',
    caption: 'إعدادات الشركة والعلامة والعملة واللغة في مكان واحد.',
  },
  {
    id: 'form',
    label: 'نموذج موحّد',
    icon: ClipboardList,
    src: '/landing/entity-form.png',
    alt: 'النموذج الموحّد لإدخال البيانات في Rentrix',
    caption: 'نموذج استجابة واحد للجوال والحاسوب لإدخال العقود والجهات.',
  },
];

const points = [
  'لوحة تحكم بصرية بمؤشرات أداء العقارات والتحصيل والمتأخرات.',
  'مركز تقارير يجمع التحصيلات والمتأخرات والإشغال والمحاسبة.',
  'فواتير وتحصيلات ومصروفات مع كشوف حساب قابلة للتصدير.',
];

export function ShowcaseSection() {
  const [active, setActive] = useState<string>('reports');
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  return (
    <section id="showcase" className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-black uppercase tracking-widest text-primary">كيف يعمل</span>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            مساحة عمل واحدة لكل عملياتك العقارية
          </h2>
          <p className="mt-3 text-sm font-bold leading-6 text-muted-foreground">
            من لوحة التحكم إلى التقارير والإعدادات، كل شاشة مبنية لتكون واضحة وسريعة على الجوال والحاسوب.
          </p>
        </div>

        <div className="mt-8 inline-flex flex-wrap gap-1.5 rounded-2xl border border-border/60 bg-card p-1.5 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl ring-1 ring-black/5">
          <ProductScreenshot
            key={current.id}
            src={current.src}
            alt={current.alt}
            className="rounded-none border-0 shadow-none"
          />
          <div className="border-t border-border/60 bg-muted/30 px-5 py-3 text-sm font-bold text-muted-foreground">
            {current.caption}
          </div>
        </div>

        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4">
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
    </section>
  );
}
