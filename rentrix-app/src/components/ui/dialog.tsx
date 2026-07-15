import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-dialog-content
      className={cn(
        'fixed left-1/2 top-1/2 z-[101] grid max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] min-h-0 w-[calc(100vw-1rem)] max-w-[42rem] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] text-card-foreground shadow-elevated [scrollbar-gutter:stable] sm:max-h-[min(calc(var(--visual-viewport-height,100dvh)-3rem),54rem)] sm:w-[min(92vw,42rem)] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pt-[calc(1.5rem+env(safe-area-inset-top,0px))]',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close
          className="absolute end-3 top-[calc(0.75rem+env(safe-area-inset-top,0px))] grid size-11 place-items-center rounded-xl text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20 sm:end-4 sm:top-[calc(1rem+env(safe-area-inset-top,0px))]"
          aria-label="إغلاق"
        >
          <X className="size-4" />
          <span className="sr-only">إغلاق</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export function DialogHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('space-y-2 text-start', className)} {...props} />;
}

export function DialogBody({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-dialog-scroll
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-bold', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}