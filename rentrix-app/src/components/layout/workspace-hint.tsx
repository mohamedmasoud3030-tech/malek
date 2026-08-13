import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WorkspaceHintProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

/**
 * Shared page-level hint — one quiet surface for finance/reports/ops notes.
 * Replaces the ad-hoc emoji chips that made hubs look like debug banners.
 */
export function WorkspaceHint({ children, className }: WorkspaceHintProps) {
  return (
    <p
      data-workspace-hint
      className={cn(
        'inline-flex max-w-full items-start rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs font-medium leading-5 text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}
