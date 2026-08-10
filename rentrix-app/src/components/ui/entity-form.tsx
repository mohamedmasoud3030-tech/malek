import type { ComponentPropsWithoutRef, FormEventHandler, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type ResponsiveFormSurface = 'dialog';
export type EntityFormSurfacePreference = 'auto' | 'dialog';
export type EntityFormVisualVariant = 'operational';

const invalidFieldSelector = [
  '[aria-invalid="true"]:not([disabled])',
  '[data-invalid="true"]:not([disabled])',
  'input:invalid:not([disabled])',
  'select:invalid:not([disabled])',
  'textarea:invalid:not([disabled])',
].join(',');

const EntityFormVisualContext = createContext<EntityFormVisualVariant | undefined>(undefined);

export function EntityFormVisualProvider({
  variant,
  children,
}: Readonly<{
  variant?: EntityFormVisualVariant;
  children: ReactNode;
}>) {
  return (
    <EntityFormVisualContext.Provider value={variant}>
      {children}
    </EntityFormVisualContext.Provider>
  );
}

export function getResponsiveFormSurface(): ResponsiveFormSurface {
  return 'dialog';
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
  /** @deprecated Entity forms always use the shared responsive Dialog. */
  surface?: EntityFormSurfacePreference;
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

function Overlay({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  children,
  className,
  visualVariant,
}: EntityFormOverlayProps) {
  const inheritedVisualVariant = useContext(EntityFormVisualContext);
  const resolvedVisualVariant = visualVariant ?? inheritedVisualVariant;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-entity-form-surface="dialog"
        data-entity-form-variant={resolvedVisualVariant}
        className={cn('flex max-h-[calc(var(--visual-viewport-height,100dvh)-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(calc(var(--visual-viewport-height,100dvh)-2rem),54rem)]', className)}
      >
        <DialogHeader className="shrink-0 bg-[hsl(var(--sidebar))] px-4 py-4 pe-14 text-white shadow-sm sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-white">{title}</DialogTitle>
            {headerExtra}
          </div>
          {description ? <DialogDescription className="leading-6 text-white/75">{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody data-entity-form-scroll className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:pb-6">
          {children}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const EntityForm = Object.assign(Root, { Root, Field, Section, ErrorSummary, Actions, Overlay });
