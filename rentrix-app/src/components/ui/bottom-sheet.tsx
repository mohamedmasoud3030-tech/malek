import { useEffect, useId, useRef } from 'react';
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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const sheet = sheetRef.current;

    const focusFirstControl = window.requestAnimationFrame(() => {
      const firstFocusable = sheet?.querySelector<HTMLElement>(focusableSelector);
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

    return () => {
      window.cancelAnimationFrame(focusFirstControl);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default touch-none bg-black/55 backdrop-blur-[2px]"
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
        className={cn(
          'relative z-10 w-full max-w-full overflow-hidden rounded-t-[1.75rem] border border-b-0 border-border/60 bg-background outline-none',
          'shadow-[0_-24px_70px_rgba(0,0,0,0.28)]',
          'animate-in slide-in-from-bottom duration-300',
          'max-h-[calc(100dvh-0.5rem)]',
          'ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)]',
          className,
        )}
      >
        <div className="flex justify-center pb-1 pt-3" aria-hidden="true">
          <div className="h-1.5 w-11 rounded-full bg-muted-foreground/20" />
        </div>

        {title ? (
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/96 px-4 py-3 backdrop-blur sm:px-5">
            <h2 id={titleId} className="min-w-0 text-base font-black leading-7">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              aria-label="إغلاق"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div className="max-h-[calc(100dvh-5.25rem)] overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-5">
          {children}
        </div>
      </div>
    </div>
  );
}
