import { ShieldCheck } from 'lucide-react';
import { BrandMark } from './BrandMark';

const columns: ReadonlyArray<{ title: string; links: ReadonlyArray<string> }> = [
  { title: 'المنتج', links: ['العقارات', 'العقود', 'المالية', 'التقارير'] },
  { title: 'الشركة', links: ['من نحن', 'الدعم', 'الأسعار', 'السياسة'] },
  { title: 'القانوني', links: ['الخصوصية', 'الشروط', 'الأمان'] },
];

export function LandingFooter() {
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
