import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title ?? 'لوحة إجراء'}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 touch-none bg-black/50 backdrop-blur-[2px]"
        role="button"
        tabIndex={0}
        aria-label="إغلاق اللوحة"
        onClick={onClose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClose();
          }
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'relative z-10 w-full max-w-full rounded-t-3xl bg-background',
          'shadow-2xl ring-1 ring-border/30',
          'animate-in slide-in-from-bottom duration-300',
          'max-h-[calc(100dvh-0.75rem)] overflow-y-auto overscroll-contain',
          'pb-[env(safe-area-inset-bottom,0px)] ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)]',
          className,
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur sm:px-5">
            <h2 className="min-w-0 text-base font-bold leading-7">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}
