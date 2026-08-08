/*
 * ============================================
 * MALIK PRO - Modal / Dialog Component
 * Dark Header with Close Button
 * ============================================
 */

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MalikModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function MalikModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: MalikModalProps) {
  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        data-malik-modal-overlay
        className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        data-malik-modal
        data-animate-scale-in
        role="dialog"
        aria-modal="true"
        aria-labelledby="malik-modal-title"
        className={cn(
          'fixed left-1/2 top-[50%] z-[101] w-[calc(100vw-1rem)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain',
          'bg-[hsl(var(--malik-card))] rounded-2xl shadow-[var(--malik-shadow-modal)]',
          'border border-[hsl(var(--malik-border))]',
          'flex flex-col',
          'rtl:direction-rtl',
          sizeClasses[size],
          className
        )}
      >
        {/* Header - Dark Navy */}
        <header data-malik-modal-header className="shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 id="malik-modal-title" data-malik-modal-title>
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-sm text-white/70">{description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            data-malik-modal-close
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق"
            className="shrink-0"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div data-malik-modal-body className="flex-1 overflow-y-auto p-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer data-malik-modal-footer className="shrink-0">
            {footer}
          </footer>
        )}
      </div>
    </>
  );
}

// Modal Header Component
export function MalikModalHeader({
  title,
  description,
  onClose,
}: {
  title: string;
  description?: string;
  onClose?: () => void;
}) {
  return (
    <header data-malik-modal-header>
      <div className="flex items-center gap-3">
        <div>
          <h2 id="malik-modal-title" data-malik-modal-title>
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-white/70">{description}</p>
          )}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          data-malik-modal-close
          onClick={onClose}
          aria-label="إغلاق"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      )}
    </header>
  );
}

// Modal Body Component
export function MalikModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div data-malik-modal-body className={cn('p-6', className)}>
      {children}
    </div>
  );
}

// Modal Footer Component
export function MalikModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <footer
      data-malik-modal-footer
      className={cn(
        'flex justify-end gap-3 border-t border-[hsl(var(--malik-border-light))]',
        'bg-[hsl(var(--malik-muted))] p-4',
        className
      )}
    >
      {children}
    </footer>
  );
}

// Overlay Component for external use
export function MalikModalOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      data-malik-modal-overlay
      className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
