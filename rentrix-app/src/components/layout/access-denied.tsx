import { Link } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AccessDeniedProps = Readonly<{
  message?: string;
}>;

export function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <div className="px-3 py-6 sm:px-4 sm:py-8" dir="rtl">
      <section className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-card" role="alert">
        <div className="h-1 bg-destructive" aria-hidden="true" />
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/8 text-destructive">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black">غير مصرح بالوصول</h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
              {message ?? 'ليس لديك الصلاحية اللازمة لعرض هذه الصفحة. تواصل مع المدير أو المسؤول إذا كنت تحتاج إلى الوصول.'}
            </p>
            <Button asChild size="sm" className="mt-3 min-h-11">
              <Link to="/dashboard">العودة إلى لوحة التحكم</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
