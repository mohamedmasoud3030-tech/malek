import type { ComponentPropsWithoutRef, FormEventHandler, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
  return <form className={cn('grid min-w-0 gap-5', className)} noValidate {...props}>{children}</form>;
}

type EntityFormSectionProps = Readonly<{
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}>;

type EntityFormFieldProps = Readonly<{
  label: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  className?: string;
}>;

function Field({ label, children, description, error, className }: EntityFormFieldProps) {
  return (
    <label className={cn('grid min-w-0 gap-2 text-sm font-bold', className)}>
      <span>{label}</span>
      {description ? <span className="text-xs font-medium leading-5 text-muted-foreground">{description}</span> : null}
      {children}
      {error ? (
        <span className="text-xs font-bold leading-5 text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Section({ title, description, children, className }: EntityFormSectionProps) {
  return (
    <section className={cn('min-w-0 space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:p-4', className)}>
      {title || description ? (
        <div className="border-b border-border/50 pb-3">
          {title ? <h2 className="text-sm font-black leading-6">{title}</h2> : null}
          {description ? <p className="mt-0.5 text-xs font-medium leading-5 text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
  );
}

type EntityFormErrorSummaryProps = Readonly<{ message?: ReactNode; className?: string }>;

function ErrorSummary({ message, className }: EntityFormErrorSummaryProps) {
  if (!message) return null;
  return (
    <div
      className={cn('rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold leading-6 text-destructive', className)}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </div>
  );
}

type EntityFormActionsProps = Readonly<{
  submitLabel: ReactNode;
  cancelLabel?: ReactNode;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  submitVariant?: ComponentPropsWithoutRef<typeof Button>['variant'];
  className?: string;
}>;

function Actions({ submitLabel, cancelLabel = 'إلغاء', onCancel, isSubmitting, submitDisabled, submitVariant, className }: EntityFormActionsProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 grid grid-cols-1 gap-2 border-t border-border/70 bg-background/96 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:flex-row-reverse sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0',
        className,
      )}
    >
      <Button type="submit" variant={submitVariant} disabled={submitDisabled ?? isSubmitting} className="min-h-11 w-full sm:w-auto">
        {submitLabel}
      </Button>
      {onCancel ? (
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting} className="min-h-11 w-full sm:w-auto">
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  );
}

type EntityFormOverlayProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}>;

function Overlay({ open, onOpenChange, title, description, headerExtra, children, className }: EntityFormOverlayProps) {
  const surface = getResponsiveFormSurface(useMediaQuery(mobileFormQuery));

  if (surface === 'bottom-sheet') {
    return (
      <BottomSheet open={open} onClose={() => onOpenChange(false)} title={title} className={className}>
        {description || headerExtra ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/35 p-3">
            {description ? <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-muted-foreground">{description}</p> : null}
            {headerExtra}
          </div>
        ) : null}
        {children}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[min(90dvh,54rem)] max-w-2xl overflow-y-auto p-0', className)}>
        <DialogHeader className="sticky top-0 z-10 border-b border-border/60 bg-background/96 px-6 py-5 pe-14 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{title}</DialogTitle>
            {headerExtra}
          </div>
          {description ? <DialogDescription className="leading-6">{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export const EntityForm = Object.assign(Root, { Root, Field, Section, ErrorSummary, Actions, Overlay });