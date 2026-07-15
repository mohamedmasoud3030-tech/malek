import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Section header used inside cards and page sections.
 * Consistent typography: 15px semibold title, 13px description.
 */
export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold leading-6">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
