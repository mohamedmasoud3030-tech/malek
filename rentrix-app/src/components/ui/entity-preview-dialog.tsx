import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { cn } from '@/lib/utils';

export function EntityPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  className,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className={cn(
          'max-h-[94dvh] w-[calc(100vw-1rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:w-[min(96vw,76rem)] sm:max-w-6xl',
          className,
        )}
      >
        <DialogHeader className="border-b border-border/70 bg-[hsl(var(--sidebar))] px-5 py-5 pe-16 text-[hsl(var(--sidebar-foreground))] sm:px-7 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-black text-inherit sm:text-2xl">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-sm text-[hsl(var(--sidebar-foreground)/0.72)]">
                  {description}
                </DialogDescription>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2 pe-2">{actions}</div> : null}
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto bg-background/60 p-4 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
