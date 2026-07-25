import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';
import { forwardRef, useCallback, useEffect, useState } from 'react';
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

const dataEntryControlSelector = 'input:not([type="hidden"]), select, textarea';
type DialogContentElement = ElementRef<typeof DialogPrimitive.Content>;
type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
};

export const DialogContent = forwardRef<DialogContentElement, DialogContentProps>(
  function DialogContent({ className, children, showCloseButton = true, style, ...props }, forwardedRef) {
    const [contentNode, setContentNode] = useState<DialogContentElement | null>(null);
    const [containsDataEntryControls, setContainsDataEntryControls] = useState(false);

    const setContentRef = useCallback((node: DialogContentElement | null) => {
      setContentNode((current) => (current === node ? current : node));
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as { current: DialogContentElement | null }).current = node;
      }
    }, [forwardedRef]);

    useEffect(() => {
      if (!contentNode) {
        setContainsDataEntryControls(false);
        return;
      }

      const updateClassification = () => {
        setContainsDataEntryControls(Boolean(contentNode.querySelector(dataEntryControlSelector)));
      };

      updateClassification();
      if (typeof MutationObserver === 'undefined') return;

      const observer = new MutationObserver(updateClassification);
      observer.observe(contentNode, { childList: true, subtree: true });
      return () => observer.disconnect();
    }, [contentNode]);

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={setContentRef}
          data-dialog-content
          data-dialog-form={containsDataEntryControls ? 'true' : undefined}
          className={cn(
            'fixed left-1/2 top-[var(--visual-viewport-center-y,50%)] z-[101] grid max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] min-h-0 w-[calc(100vw-1rem)] max-w-[42rem] gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] text-card-foreground shadow-elevated [scrollbar-gutter:stable] sm:max-h-[min(calc(var(--visual-viewport-height,100dvh)-3rem),54rem)] sm:w-[min(92vw,42rem)] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pt-[calc(1.5rem+env(safe-area-inset-top,0px))]',
            className,
          )}
          style={{ transform: 'translate3d(-50%, -50%, 0)', ...style }}
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
    );
  },
);
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
