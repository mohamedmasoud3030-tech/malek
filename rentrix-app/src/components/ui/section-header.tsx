import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small semantic kicker above the title — establishes hierarchy without decoration. */
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

/** Section-level heading: one stable type/spacing rhythm across all workspaces. */
export function SectionHeader({ title, description, eyebrow, action, className }: SectionHeaderProps) {
  return (
    <div data-section-header className={cn('mb-3 flex min-w-0 items-start justify-between gap-3 lg:mb-4 lg:gap-4', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-0.5 text-[0.6875rem] font-extrabold leading-4 text-primary" data-section-eyebrow>
            {eyebrow}
          </p>
        ) : null}
        <h2 className="break-words text-base font-bold leading-6 [overflow-wrap:anywhere]">{title}</h2>
        {description ? (
          <p className="mt-0.5 break-words text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
