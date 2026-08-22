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
    <Card data-empty-state className="min-w-0 overflow-hidden border-dashed border-border/70 shadow-none" role={role} aria-live={ariaLive} dir="rtl">
      <CardContent className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-4 text-center sm:min-h-28">
        <div data-empty-state-icon className="grid size-8 place-items-center rounded-md bg-muted/70 text-muted-foreground/45">
          <Inbox className="size-3.5" />
        </div>
        <div className="min-w-0 max-w-full overflow-hidden">
          <h3 className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{title}</h3>
          <p className="mt-0.5 max-w-md break-words text-[0.75rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">{description}</p>
        </div>
        {action ? <div className="min-w-0 max-w-full">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
