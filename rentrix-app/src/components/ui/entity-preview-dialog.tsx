import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
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
        showCloseButton={false}
        className={cn(
          'max-h-[94dvh] w-[calc(100vw-1rem)] max-w-5xl gap-0 overflow-hidden p-0 sm:w-[min(96vw,76rem)] sm:max-w-6xl',
          className,
        )}
      >
        <DialogHeader className="border-b border-white/10 bg-[hsl(var(--sidebar))] px-5 py-5 text-[hsl(var(--sidebar-foreground))] sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <DialogClose
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/8 text-white/80 outline-none transition hover:bg-white/14 hover:text-white focus-visible:ring-4 focus-visible:ring-white/25"
              aria-label="إغلاق المعاينة"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogClose>
            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black text-inherit sm:text-2xl">{title}</DialogTitle>
                {description ? (
                  <DialogDescription className="mt-1 text-sm text-[hsl(var(--sidebar-foreground)/0.72)]">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto bg-background/60 p-4 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
