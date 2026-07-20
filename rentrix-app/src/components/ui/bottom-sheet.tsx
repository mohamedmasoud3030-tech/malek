import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

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
      style={{
        top: 'var(--visual-viewport-offset-top, 0px)',
        left: 'var(--visual-viewport-offset-left, 0px)',
        width: 'var(--visual-viewport-width, 100vw)',
        height: 'var(--visual-viewport-height, 100dvh)',
      }}
      role="presentation"
      data-bottom-sheet-root
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default touch-none bg-black/45 backdrop-blur-sm"
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
          'relative z-10 flex w-full max-w-full min-w-0 flex-col overflow-hidden rounded-t-3xl border border-b-0 border-border/50 bg-card outline-none',
          'shadow-[0_-8px_48px_-8px_rgba(0,0,0,0.18),0_-1px_0_0_hsl(var(--border)/0.5)]',
          'animate-in slide-in-from-bottom duration-300 ease-out',
          'max-h-[calc(var(--visual-viewport-height,100dvh)-0.5rem)]',
          'ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)]',
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 justify-center pb-1.5 pt-3.5 focus-visible:outline-none"
          aria-label="إغلاق اللوحة"
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/25 transition-colors hover:bg-muted-foreground/40" />
        </button>

        {title ? (
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/96 px-4 py-3 backdrop-blur sm:px-5">
            <h2 id={titleId} className="min-w-0 text-[0.9375rem] font-bold leading-7">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              aria-label="إغلاق"
            >
              <X className="size-[0.9rem]" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          data-bottom-sheet-scroll
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-5 sm:[scrollbar-gutter:stable]"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
