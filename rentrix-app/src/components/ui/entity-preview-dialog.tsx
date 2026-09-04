import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogOverlay } from './dialog';
import { cn } from '@/lib/utils';

/**
 * MALEK canonical Quick Preview shell.
 *
 * One component for every record inspection surface — workspace entities and
 * transactional records alike. It is a *temporary inspection window*, not a
 * page: compact centered modal, clearly smaller than the viewport on desktop
 * and visibly modal on mobile, with the register still visible behind the
 * backdrop. Fully worked-out detail lives on the canonical detail page and is
 * reached through an explicit action (usually in `footer`).
 *
 * Mobile and desktop share this exact component and semantics; only the
 * responsive sizing differs. Use the `lg` variant only when content genuinely
 * needs it (e.g. an operational form inside the preview).
 */
export type EntityPreviewSize = 'md' | 'lg';

const previewSizeClasses: Record<EntityPreviewSize, string> = {
  // Medium modal range: never viewport-width, never page-height.
  md: 'w-[calc(100vw-1.5rem)] max-w-[22rem] sm:w-[min(92vw,30rem)] md:max-w-[36rem]',
  lg: 'w-[calc(100vw-1.5rem)] max-w-[24rem] sm:w-[min(94vw,34rem)] md:max-w-[40rem]',
};

export function EntityPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  status,
  actions,
  children,
  footer,
  className,
  size = 'md',
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Compact status/context node rendered beside the title (e.g. StatusBadge). */
  status?: ReactNode;
  /** Header actions — keep these few and explicit. */
  actions?: ReactNode;
  children: ReactNode;
  /** Sticky action area (e.g. «فتح الملف الكامل» / print). Always visible. */
  footer?: ReactNode;
  className?: string;
  size?: EntityPreviewSize;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay
        onPointerDown={(event) => {
          // Read-only inspection: backdrop click closes and returns the user
          // to the exact register state below.
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
      />
      <DialogContent
        dir="rtl"
        showCloseButton={false}
        className={cn(
          'flex max-h-[min(calc(var(--visual-viewport-height,100dvh)-1.25rem),38rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(calc(var(--visual-viewport-height,100dvh)-3rem),44rem)]',
          previewSizeClasses[size],
          className,
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 bg-[hsl(var(--sidebar))] px-4 py-4 text-[hsl(var(--sidebar-foreground))] sm:px-5">
          <div className="flex items-start gap-2.5">
            <DialogClose
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/8 text-white/80 outline-none transition hover:bg-white/14 hover:text-white focus-visible:ring-4 focus-visible:ring-white/25"
              aria-label="إغلاق المعاينة"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogClose>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                <DialogTitle className="min-w-0 flex-1 truncate text-base font-black text-inherit sm:text-lg">
                  {title}
                </DialogTitle>
                {status ? <div className="shrink-0">{status}</div> : null}
              </div>
              {description ? (
                <DialogDescription className="mt-1 text-xs leading-5 text-[hsl(var(--sidebar-foreground)/0.72)]">
                  {description}
                </DialogDescription>
              ) : null}
              {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background/60 p-4 sm:p-5">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-border/70 bg-background/90 px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
