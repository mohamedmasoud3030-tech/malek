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
    <Card data-empty-state className="border-dashed" role={role} aria-live={ariaLive}>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
        <div data-empty-state-icon className="grid size-14 place-items-center rounded-xl bg-muted text-muted-foreground/40">
          <Inbox className="size-7" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-[0.8125rem] leading-6 text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
