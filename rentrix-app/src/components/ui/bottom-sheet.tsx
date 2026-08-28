import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export const visualViewportOverlayStyle = {
  top: 'var(--visual-viewport-offset-top, 0px)',
  left: 'var(--visual-viewport-offset-left, 0px)',
  width: 'var(--visual-viewport-width, 100vw)',
  height: 'var(--visual-viewport-height, 100dvh)',
} satisfies CSSProperties;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const sheet = sheetRef.current;

    const focusFirstControl = window.requestAnimationFrame(() => {
      const firstContentControl = scrollRef.current?.querySelector<HTMLElement>(focusableSelector);
      const firstFocusable = firstContentControl ?? sheet?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? sheet)?.focus();
    });

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(focusFirstControl);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[100] flex min-w-0 flex-col justify-end overflow-hidden"
      style={visualViewportOverlayStyle}
      role="presentation"
      data-bottom-sheet-root
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default touch-none bg-[hsl(var(--overlay)/0.48)]"
        aria-label="إغلاق اللوحة"
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'لوحة إجراء'}
        data-bottom-sheet
        className={cn(
          'relative z-10 flex w-full max-w-full min-w-0 flex-col overflow-hidden rounded-t-[1.35rem] border border-b-0 border-border bg-card outline-none',
          'shadow-[0_-18px_44px_-28px_hsl(var(--overlay)/0.55),0_-1px_0_0_hsl(var(--border)/0.7)]',
          'max-h-[calc(var(--visual-viewport-height,100dvh)-0.75rem)]',
          'ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)]',
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          data-bottom-sheet-handle
          className="flex min-h-8 shrink-0 cursor-grab items-center justify-center pb-1 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 active:cursor-grabbing"
          aria-label="مقبض اللوحة — اضغط للإغلاق"
        >
          <div className="h-1 w-9 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/45 motion-reduce:transition-none" />
        </button>

        {title ? (
          <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3.5 py-2 sm:px-4">
            <h2 id={titleId} className="min-w-0 text-base font-extrabold leading-6 text-foreground">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none"
              aria-label="إغلاق"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          data-bottom-sheet-scroll
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2.5 sm:px-4 sm:[scrollbar-gutter:stable]"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
