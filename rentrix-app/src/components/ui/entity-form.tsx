import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, FormEventHandler, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const mobileFormQuery = '(max-width: 767px)';
const invalidFieldSelector = [
  '[aria-invalid="true"]:not([disabled])',
  '[data-invalid="true"]:not([disabled])',
  'input:invalid:not([disabled])',
  'select:invalid:not([disabled])',
  'textarea:invalid:not([disabled])',
].join(',');

export type ResponsiveFormSurface = 'bottom-sheet' | 'dialog' | 'full-page';
export type EntityFormSurfacePreference = 'auto' | ResponsiveFormSurface;
export type EntityFormVisualVariant = 'operational';

export function getResponsiveFormSurface(
  matchesMobile: boolean,
  preference: EntityFormSurfacePreference = 'auto',
  mobilePreference: Exclude<ResponsiveFormSurface, 'dialog'> = 'full-page',
): ResponsiveFormSurface {
  if (preference !== 'auto') return preference;
  return matchesMobile ? mobilePreference : 'dialog';
}

export function focusFirstInvalidField(form: HTMLFormElement, behavior: ScrollBehavior = 'smooth') {
  const invalidField = form.querySelector<HTMLElement>(invalidFieldSelector);
  if (!invalidField) return null;

  invalidField.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior });
  try {
    invalidField.focus({ preventScroll: true });
  } catch {
    invalidField.focus();
  }
  return invalidField;
}

function scheduleInvalidFieldFocus(form: HTMLFormElement) {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => focusFirstInvalidField(form), 0);
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

function Root({ className, children, onSubmit, onInvalidCapture, noValidate = true, ...props }: EntityFormRootProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    const form = event.currentTarget;
    onSubmit?.(event);
    scheduleInvalidFieldFocus(form);
  };

  const handleInvalidCapture: NonNullable<EntityFormRootProps['onInvalidCapture']> = (event) => {
    onInvalidCapture?.(event);
    scheduleInvalidFieldFocus(event.currentTarget);
  };

  return (
    <form
      data-entity-form
      className={cn('entity-form grid min-w-0 gap-5', className)}
      noValidate={noValidate}
      onSubmit={handleSubmit}
      onInvalidCapture={handleInvalidCapture}
      {...props}
    >
      {children}
    </form>
  );
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
    <label data-entity-form-field className={cn('grid min-w-0 gap-2 text-sm font-bold', className)}>
      <span>{label}</span>
      {description ? <span className="text-xs font-medium leading-5 text-muted-foreground">{description}</span> : null}
      {children}
      {error ? (
        <span data-field-error className="text-xs font-bold leading-5 text-destructive" role="alert">
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
          {title ? <h2 className="text-sm font-semibold leading-6">{title}</h2> : null}
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
      data-entity-form-error-summary
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
      data-entity-form-actions
      className={cn(
        'sticky bottom-[var(--entity-form-action-offset,0px)] z-20 -mx-4 grid gap-2 border-t border-border/70 bg-background/96 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] pt-2.5 shadow-[0_-12px_30px_hsl(var(--background)/0.92)] backdrop-blur',
        onCancel ? 'grid-cols-[minmax(0,1fr)_minmax(6.5rem,0.42fr)]' : 'grid-cols-1',
        'sm:static sm:mx-0 sm:flex sm:flex-row-reverse sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0 sm:shadow-none',
        className,
      )}
    >
      <Button
        data-entity-form-submit
        type="submit"
        variant={submitVariant}
        disabled={submitDisabled ?? isSubmitting}
        className="min-h-11 min-w-0 w-full sm:w-auto"
      >
        {submitLabel}
      </Button>
      {onCancel ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          className="min-h-11 min-w-0 w-full sm:w-auto"
        >
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
  surface?: EntityFormSurfacePreference;
  mobileSurface?: Exclude<ResponsiveFormSurface, 'dialog'>;
  visualVariant?: EntityFormVisualVariant;
}>;

function OverlayHeader({ title, description, headerExtra }: Pick<EntityFormOverlayProps, 'title' | 'description' | 'headerExtra'>) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 text-lg font-bold leading-7">{title}</h2>
        {headerExtra}
      </div>
      {description ? <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function FullPageOverlay({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  children,
  className,
  visualVariant,
}: EntityFormOverlayProps) {
  if (!open) return null;

  return (
    <div
      data-entity-form-surface="full-page"
      data-entity-form-variant={visualVariant}
      className="fixed z-[110] min-w-0 overflow-hidden bg-background text-foreground"
      style={{
        top: 'var(--visual-viewport-offset-top, 0px)',
        left: 'var(--visual-viewport-offset-left, 0px)',
        width: 'var(--visual-viewport-width, 100vw)',
        height: 'var(--visual-viewport-height, 100dvh)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={cn('mx-auto flex h-full w-full max-w-4xl min-w-0 flex-col overflow-hidden', className)}>
        <header className="safe-top-app flex shrink-0 items-start gap-2 border-b border-border/70 bg-background/96 px-3 py-2.5 backdrop-blur sm:items-center sm:gap-3 sm:px-6 sm:py-3">
          <OverlayHeader title={title} description={description} headerExtra={headerExtra} />
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="إغلاق">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>
        <div
          data-entity-form-scroll
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:py-6 sm:[scrollbar-gutter:stable]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Overlay({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  children,
  className,
  surface = 'auto',
  mobileSurface = 'full-page',
  visualVariant,
}: EntityFormOverlayProps) {
  const resolvedSurface = getResponsiveFormSurface(useMediaQuery(mobileFormQuery), surface, mobileSurface);

  if (resolvedSurface === 'full-page') {
    return (
      <FullPageOverlay
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        headerExtra={headerExtra}
        className={className}
        visualVariant={visualVariant}
      >
        {children}
      </FullPageOverlay>
    );
  }

  if (resolvedSurface === 'bottom-sheet') {
    return (
      <BottomSheet open={open} onClose={() => onOpenChange(false)} title={title} className={className}>
        <div
          data-entity-form-surface="bottom-sheet"
          data-entity-form-variant={visualVariant}
          className="min-w-0 max-w-full overflow-x-hidden"
        >
          {description || headerExtra ? (
            <div className="mb-4 flex min-w-0 flex-wrap items-center gap-2 rounded-2xl bg-muted/35 p-3">
              {description ? <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-muted-foreground">{description}</p> : null}
              {headerExtra}
            </div>
          ) : null}
          {children}
        </div>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-entity-form-surface="dialog"
        data-entity-form-variant={visualVariant}
        className={cn('flex max-h-[min(calc(var(--visual-viewport-height,100dvh)-2rem),54rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0', className)}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 bg-background/96 px-6 py-5 pe-14 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{title}</DialogTitle>
            {headerExtra}
          </div>
          {description ? <DialogDescription className="leading-6">{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody data-entity-form-scroll className="px-6 pb-6 pt-4">
          {children}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const EntityForm = Object.assign(Root, { Root, Field, Section, ErrorSummary, Actions, Overlay });
