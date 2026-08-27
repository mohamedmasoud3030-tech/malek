/**
 * Shared empty state.
 *
 * Icon chip, title, description, spacing and type scale are the single state
 * surface contract shared with OfflineState / NoPermissionState (state-surfaces.tsx)
 * and ErrorState: size-10 chip, text-base semibold title, 13px/24 description.
 * The overflow-safe utilities below are load-bearing (WP-06 / GAP-020) and are
 * asserted by app/layout/browser-ux-acceptance.test.tsx.
 */
import { Inbox } from 'lucide-react';
import type { AriaAttributes, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  role?: 'status' | 'alert';
  ariaLive?: AriaAttributes['aria-live'];
};

export function EmptyState({
  title,
  description,
  action,
  role = 'status',
  ariaLive = 'polite',
}: EmptyStateProps) {
  return (
    /* No dir attribute: this surface is not portalled, so it must inherit the
       document direction. A hard-coded dir="rtl" rendered the shared empty
       state right-aligned and mirrored when the product runs in English. */
    <Card data-empty-state className="min-w-0 overflow-hidden border-dashed border-border/70 shadow-none" role={role} aria-live={ariaLive}>
      <CardContent className="flex min-h-28 flex-col items-center justify-center gap-2.5 px-4 py-5 text-center sm:min-h-28">
        <div data-empty-state-icon className="grid size-10 place-items-center rounded-lg bg-muted/70 text-muted-foreground/60">
          <Inbox className="size-5" />
        </div>
        <div className="min-w-0 max-w-full overflow-hidden">
          <h3 className="break-words text-base font-semibold [overflow-wrap:anywhere]">{title}</h3>
          <p className="mt-1 max-w-md break-words text-[0.8125rem] leading-6 text-muted-foreground [overflow-wrap:anywhere]">{description}</p>
        </div>
        {action ? <div className="min-w-0 max-w-full">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
