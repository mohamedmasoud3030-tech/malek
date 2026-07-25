import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';

type DrawerSide = 'right' | 'left' | 'bottom';

type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: DrawerSide;
  className?: string;
};

const sideClasses: Record<DrawerSide, string> = {
  right:
    'fixed bottom-0 left-auto right-0 top-0 z-[101] flex h-dvh w-[min(24rem,92vw)] max-h-none max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 border-l border-border p-0 sm:max-h-none sm:p-0',
  left:
    'fixed bottom-0 left-0 right-auto top-0 z-[101] flex h-dvh w-[min(24rem,92vw)] max-h-none max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 border-r border-border p-0 sm:max-h-none sm:p-0',
  bottom:
    'fixed inset-x-0 bottom-0 top-auto z-[101] flex max-h-[88dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-3xl border-0 border-t border-border p-0 sm:max-w-none sm:p-0',
};

/**
 * Side/bottom drawer built on the shared Dialog primitive.
 * Use for filters, quick create, and secondary workflows.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
}: DrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(sideClasses[side], 'bg-card text-card-foreground shadow-xl', className)}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
          <div className="min-w-0">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-1 text-xs font-bold text-muted-foreground">
                {description}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>

        {footer ? (
          <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
