import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductScreenshot } from './ProductScreenshot';

const points = [
  'لوحة تحكم بصرية بمؤشرات أداء العقارات والتحصيل والمتأخرات.',
  'مركز تقارير يجمع التحصيلات والمتأخرات والإشغال والمحاسبة.',
  'فواتير وتحصيلات ومصروفات مع كشوف حساب قابلة للتصدير.',
];

export function ShowcaseSection() {
  return (
    <section id="showcase" className="border-y border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-primary">كيف يعمل</span>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            مساحة عمل واحدة لكل عملياتك العقارية
          </h2>
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
          <ProductScreenshot src="/landing/workspace.png" alt="مساحة عمل Rentrix الحقيقية" />
        </div>
      </div>
    </section>
  );
}
