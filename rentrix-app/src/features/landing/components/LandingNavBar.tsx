import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { BrandMark } from './BrandMark';

export function LandingNavBar() {
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
          <a href="#features" className="transition hover:text-foreground">
            المزايا
          </a>
          <a href="#showcase" className="transition hover:text-foreground">
            كيف يعمل
          </a>
          <a href="#why" className="transition hover:text-foreground">
            لماذا Rentrix
          </a>
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
