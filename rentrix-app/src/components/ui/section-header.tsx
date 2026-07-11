import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Small header used inside cards and sections — title + optional link/action.
 * Replaces the repeated `mb-3 flex items-center justify-between` pattern.
 *
 * @example
 * <SectionHeader
 *   title="العقود المنتهية قريباً"
 *   action={<Link to="/contracts">عرض الكل</Link>}
 * />
 */
export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs font-bold leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action && <div className="shrink-0 text-xs font-bold text-primary">{action}</div>}
    </div>
  );
}
