import { Link } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StateSurface } from '@/components/ui/state-surfaces';

type AccessDeniedProps = Readonly<{
  message?: string;
}>;

export function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <div className="px-3 py-6 sm:px-4 sm:py-8" data-access-denied-surface>
      <StateSurface
        kind="permission"
        tone="danger"
        icon={<ShieldAlert className="size-5" aria-hidden="true" />}
        title="غير مصرح بالوصول"
        description={message ?? 'ليس لديك الصلاحية اللازمة لعرض هذه الصفحة. تواصل مع المدير أو المسؤول إذا كنت تحتاج إلى الوصول.'}
        role="alert"
        className="mx-auto w-full max-w-xl border-destructive/20 bg-card"
        action={(
          <Button asChild size="sm" className="mt-1 min-h-11">
            <Link to="/dashboard">العودة إلى لوحة التحكم</Link>
          </Button>
        )}
      />
    </div>
  );
}
