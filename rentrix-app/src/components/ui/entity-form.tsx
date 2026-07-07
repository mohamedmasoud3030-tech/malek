import type { ComponentPropsWithoutRef, FormEventHandler, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const mobileFormQuery = '(max-width: 767px)';

export type ResponsiveFormSurface = 'bottom-sheet' | 'dialog';

export function getResponsiveFormSurface(matchesMobile: boolean): ResponsiveFormSurface {
  return matchesMobile ? 'bottom-sheet' : 'dialog';
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener('change', updateMatches);
    return () => mediaQuery.removeEventListener('change', updateMatches);
  }, [query]);

  return matches;
}

type EntityFormRootProps = Readonly<ComponentPropsWithoutRef<'form'> & {
  onSubmit?: FormEventHandler<HTMLFormElement>;
  'aria-busy'?: boolean | 'true' | 'false';
}>;

function Root({ className, children, ...props }: EntityFormRootProps) {
  return <form className={cn('grid gap-4', className)} {...props}>{children}</form>;
}

type EntityFormSectionProps = Readonly<{ title?: string; description?: string; children: ReactNode; className?: string }>;

function Section({ title, description, children, className }: EntityFormSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      {(title || description) ? (
        <div>
          {title ? <h2 className="text-sm font-black">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type EntityFormErrorSummaryProps = Readonly<{ message?: ReactNode; className?: string }>;

function ErrorSummary({ message, className }: EntityFormErrorSummaryProps) {
  if (!message) return null;
  return <div className={cn('rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold text-destructive', className)} role="alert">{message}</div>;
}

type EntityFormActionsProps = Readonly<{
  submitLabel: ReactNode;
  cancelLabel?: ReactNode;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  className?: string;
}>;

function Actions({ submitLabel, cancelLabel = 'إلغاء', onCancel, isSubmitting, submitDisabled, className }: EntityFormActionsProps) {
  return (
    <div className={cn('safe-bottom-overlay -mx-4 flex flex-col-reverse gap-3 border-t border-border/60 px-4 pt-4 sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:px-0 sm:pb-0', className)}>
      {onCancel ? <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>{cancelLabel}</Button> : null}
      <Button type="submit" disabled={submitDisabled ?? isSubmitting}>{submitLabel}</Button>
    </div>
  );
}

type EntityFormOverlayProps = Readonly<{ open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; className?: string }>;

function Overlay({ open, onOpenChange, title, description, children, className }: EntityFormOverlayProps) {
  const surface = getResponsiveFormSurface(useMediaQuery(mobileFormQuery));

  if (surface === 'bottom-sheet') {
    return (
      <BottomSheet open={open} onClose={() => onOpenChange(false)} title={title} className={className}>
        {description ? <p className="mb-4 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        {children}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader className="pe-10">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export const EntityForm = Object.assign(Root, { Root, Section, ErrorSummary, Actions, Overlay });
