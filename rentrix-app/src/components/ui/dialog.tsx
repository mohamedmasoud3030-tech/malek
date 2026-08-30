import * as DialogPrimitive from '@radix-ui/react-dialog';
import { composeEventHandlers } from '@radix-ui/primitive';
import { X } from 'lucide-react';
import { Children, forwardRef, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, CSSProperties, ElementRef, ReactNode } from 'react';
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

function containsDialogDescription(node: ReactNode): boolean {
  return Children.toArray(node).some((child) => {
    if (!isValidElement(child)) return false;
    if (child.type === DialogDescription || child.type === DialogPrimitive.Description) return true;
    return containsDialogDescription((child.props as { children?: ReactNode }).children);
  });
}

function getDialogPlacementStyle(className?: string): CSSProperties {
  const classes = className ?? '';
  const isRightDrawer = classes.includes('right-0') && classes.includes('left-auto');
  const isLeftDrawer = classes.includes('left-0') && classes.includes('right-auto');
  const isBottomDrawer = classes.includes('bottom-0') && classes.includes('top-auto');

  if (isRightDrawer) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 'auto',
      transform: 'none',
      padding: 0,
    };
  }

  if (isLeftDrawer) {
    return {
      top: 0,
      right: 'auto',
      bottom: 0,
      left: 0,
      transform: 'none',
      padding: 0,
    };
  }

  if (isBottomDrawer) {
    return {
      top: 'auto',
      right: 0,
      bottom: 0,
      left: 0,
      transform: 'none',
      padding: 0,
    };
  }

  return { transform: 'translate3d(-50%, -50%, 0)' };
}

export const DialogContent = forwardRef<DialogContentElement, DialogContentProps>(
  function DialogContent({ className, children, showCloseButton = true, style, ...props }, forwardedRef) {
    const [contentNode, setContentNode] = useState<DialogContentElement | null>(null);
    const [containsDataEntryControls, setContainsDataEntryControls] = useState(false);
    const hasAccessibleDescription = containsDialogDescription(children);
    // Focus restoration (WCAG 2.4.3). This app opens every dialog from plain
    // buttons via state — there is no <DialogTrigger> anywhere — so Radix's
    // internal triggerRef is always null and its close-autofocus
    // (event.preventDefault() + triggerRef.focus()) drops focus to <body> on
    // close. Capture the element that opened the dialog (onOpenAutoFocus
    // fires before Radix moves focus inside) and restore it on close.
    //
    // Refs (not state) are used throughout so handlers and the unmount
    // fallback never read a stale closure.
    const contentNodeRef = useRef<DialogContentElement | null>(null);
    const lastOutsideFocusRef = useRef<HTMLElement | null>(null);

    const setContentRef = useCallback((node: DialogContentElement | null) => {
      contentNodeRef.current = node;
      setContentNode((current) => (current === node ? current : node));
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as { current: DialogContentElement | null }).current = node;
      }
    }, [forwardedRef]);

    const focusWouldBeLost = () => {
      const current = document.activeElement;
      const node = contentNodeRef.current;
      if (!(current instanceof HTMLElement) || current === document.body) return true;
      return node ? node.contains(current) : true;
    };

    const handleOpenAutoFocus = () => {
      const current = document.activeElement;
      if (current instanceof HTMLElement && current !== document.body) {
        lastOutsideFocusRef.current = current;
      }
    };

    const handleCloseAutoFocus = (event: Event) => {
      if (!focusWouldBeLost()) return;
      const previous = lastOutsideFocusRef.current;
      if (!previous || !previous.isConnected) return;
      const node = contentNodeRef.current;
      if (node?.contains(previous)) return;
      event.preventDefault();
      previous.focus();
    };

    useEffect(() => {
      return () => {
        const previous = lastOutsideFocusRef.current;
        if (!previous || !previous.isConnected) return;
        if (!focusWouldBeLost()) return;
        previous.focus();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
          aria-modal="true"
          dir={typeof document !== 'undefined' ? document.documentElement.dir || 'rtl' : 'rtl'}
          data-dialog-content
          data-dialog-form={containsDataEntryControls ? 'true' : undefined}
          onOpenAutoFocus={composeEventHandlers(props.onOpenAutoFocus, handleOpenAutoFocus)}
          onCloseAutoFocus={composeEventHandlers(props.onCloseAutoFocus, handleCloseAutoFocus)}
          className={cn(
            'fixed left-1/2 top-[var(--visual-viewport-center-y,50%)] z-[101] grid max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] min-h-0 w-[calc(100vw-1rem)] max-w-[42rem] gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-[calc(1rem+env(safe-area-inset-top,0px))] text-card-foreground shadow-elevated [scrollbar-gutter:stable] sm:max-h-[min(calc(var(--visual-viewport-height,100dvh)-3rem),54rem)] sm:w-[min(92vw,42rem)] sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pt-[calc(1.5rem+env(safe-area-inset-top,0px))]',
            className,
          )}
          style={{ ...getDialogPlacementStyle(className), ...style }}
          {...props}
        >
          {children}
          {!hasAccessibleDescription ? (
            <DialogPrimitive.Description className="sr-only">
              نافذة حوار تحتوي على معلومات أو إجراءات مرتبطة بالسياق الحالي.
            </DialogPrimitive.Description>
          ) : null}
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
