import type { ComponentPropsWithoutRef, FormEventHandler, ReactElement, ReactNode } from 'react';
import { Children, cloneElement, createContext, isValidElement, useContext, useId } from 'react';
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

export function EntityFormVisualProvider({ variant, children }: Readonly<{ variant?: EntityFormVisualVariant; children: ReactNode }>) {
  return <EntityFormVisualContext.Provider value={variant}>{children}</EntityFormVisualContext.Provider>;
}

export function getResponsiveFormSurface(): ResponsiveFormSurface { return 'dialog'; }

export function focusFirstInvalidField(form: HTMLFormElement, behavior: ScrollBehavior = 'smooth') {
  const invalidField = form.querySelector<HTMLElement>(invalidFieldSelector);
  if (!invalidField) return null;
  invalidField.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior });
  try { invalidField.focus({ preventScroll: true }); } catch { invalidField.focus(); }
  return invalidField;
}

function scheduleInvalidFieldFocus(form: HTMLFormElement) {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => focusFirstInvalidField(form), 0);
}

type EntityFormRootProps = Readonly<ComponentPropsWithoutRef<'form'> & { onSubmit?: FormEventHandler<HTMLFormElement>; 'aria-busy'?: boolean | 'true' | 'false' }>;

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
  return <form data-entity-form className={cn('entity-form grid min-w-0 gap-4', className)} noValidate={noValidate} onSubmit={handleSubmit} onInvalidCapture={handleInvalidCapture} {...props}>{children}</form>;
}

type EntityFormSectionProps = Readonly<{ title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }>;
type EntityFormFieldProps = Readonly<{ label: ReactNode; children: ReactNode; description?: ReactNode; error?: ReactNode; className?: string }>;

/**
 * Accessibility contract (WCAG 1.3.1 / 3.3.1 / 3.3.2).
 *
 * The field previously rendered the description and the error *inside* the
 * wrapping `<label>`. A wrapping label contributes its entire text content to
 * the control's accessible name, so the name became one run-on string —
 * "‏<label><description><error>" — re-announced in full on every focus, with
 * the validation error indistinguishable from the field name and no
 * programmatic description at all.
 *
 * The fix keeps the wrapping `<label>` (so every child, including composites
 * that do not forward props, keeps a label association) and additionally:
 *
 *  - points the control at the label text alone via `aria-labelledby`, which
 *    takes precedence over the wrapping label and yields a clean name;
 *  - binds description and error through `aria-describedby` so they are
 *    announced as description instead of being folded into the name;
 *  - moves the error out of the label — it was already the last row, so the
 *    rendered order is unchanged — and sets `aria-invalid` from `error` so
 *    `focusFirstInvalidField` also reaches schema-reported errors.
 *
 * Layout is preserved: the nested label reuses the same `grid gap-1.5`, so
 * every row keeps its original spacing.
 *
 * Cloning is a best-effort enhancement. When the child is not a single element
 * the wrapping label still supplies the association, exactly as before.
 */
function Field({ label, children, description, error, className }: EntityFormFieldProps) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const onlyChild = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const controlElement = isValidElement(onlyChild) ? (onlyChild as ReactElement<Record<string, unknown>>) : null;
  const childProps = (controlElement?.props ?? {}) as Record<string, unknown>;

  const describedBy = [childProps['aria-describedby'] as string | undefined, descriptionId, errorId]
    .filter(Boolean)
    .join(' ') || undefined;

  const control = controlElement
    ? cloneElement(controlElement, {
        'aria-labelledby': childProps['aria-labelledby'] ?? (childProps['aria-label'] ? undefined : labelId),
        ...(describedBy ? { 'aria-describedby': describedBy } : null),
        'aria-invalid': childProps['aria-invalid'] ?? (error ? true : undefined),
      })
    : children;

  return (
    <div data-entity-form-field className={cn('grid min-w-0 gap-1.5 text-sm font-bold', className)}>
      <label className="grid min-w-0 gap-1.5">
        <span id={labelId}>{label}</span>
        {description ? (
          <span id={descriptionId} className="text-xs font-medium leading-5 text-muted-foreground">{description}</span>
        ) : null}
        {control}
      </label>
      {error ? (
        <span id={errorId} data-field-error className="text-xs font-bold leading-5 text-destructive" role="alert">{error}</span>
      ) : null}
    </div>
  );
}

function Section({ title, description, children, className }: EntityFormSectionProps) {
  return (
    <section data-entity-form-section className={cn('min-w-0 space-y-3.5 border-b border-border/60 pb-4 last:border-b-0 last:pb-0', className)}>
      {title || description ? (
        <div className="pb-0.5">
          {title ? <h2 className="text-sm font-extrabold leading-6">{title}</h2> : null}
          {description ? <p className="mt-0.5 max-w-3xl text-xs font-medium leading-5 text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid min-w-0 gap-3 sm:gap-3.5">{children}</div>
    </section>
  );
}

type EntityFormErrorSummaryProps = Readonly<{ message?: ReactNode; className?: string }>;
function ErrorSummary({ message, className }: EntityFormErrorSummaryProps) {
  if (!message) return null;
  return <div data-entity-form-error-summary className={cn('rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold leading-6 text-destructive', className)} role="alert" aria-live="assertive">{message}</div>;
}

type EntityFormActionsProps = Readonly<{ submitLabel: ReactNode; cancelLabel?: ReactNode; onCancel?: () => void; isSubmitting?: boolean; submitDisabled?: boolean; submitVariant?: ComponentPropsWithoutRef<typeof Button>['variant']; className?: string }>;

function Actions({ submitLabel, cancelLabel = 'إلغاء', onCancel, isSubmitting, submitDisabled, submitVariant, className }: EntityFormActionsProps) {
  return (
    <div data-entity-form-actions className={cn(
      'sticky bottom-[var(--entity-form-action-offset,0px)] z-20 -mx-3 grid gap-2 border-t border-border/70 bg-background/96 px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-8px_20px_hsl(var(--background)/0.88)] backdrop-blur',
      onCancel ? 'grid-cols-[minmax(0,1fr)_minmax(6.5rem,0.42fr)]' : 'grid-cols-1',
      'sm:static sm:mx-0 sm:flex sm:flex-row-reverse sm:justify-start sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-1 sm:shadow-none',
      className,
    )}>
      <Button data-entity-form-submit type="submit" variant={submitVariant} disabled={submitDisabled ?? isSubmitting} className="min-h-11 min-w-0 w-full sm:w-auto">{submitLabel}</Button>
      {onCancel ? <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting} className="min-h-11 min-w-0 w-full sm:w-auto">{cancelLabel}</Button> : null}
    </div>
  );
}

type EntityFormOverlayProps = Readonly<{ open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: ReactNode; headerExtra?: ReactNode; children: ReactNode; className?: string; /** @deprecated Entity forms always use the shared responsive Dialog. */ surface?: EntityFormSurfacePreference; visualVariant?: EntityFormVisualVariant }>;

function Overlay({ open, onOpenChange, title, description, headerExtra, children, className, visualVariant }: EntityFormOverlayProps) {
  const inheritedVisualVariant = useContext(EntityFormVisualContext);
  const resolvedVisualVariant = visualVariant ?? inheritedVisualVariant;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-entity-form-surface="dialog" data-entity-form-variant={resolvedVisualVariant} className={cn('flex max-h-[92dvh] w-[min(calc(100vw-1rem),48rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(calc(var(--visual-viewport-height,100dvh)-2rem),52rem)] sm:w-[min(calc(100vw-2rem),48rem)]', className)}>
        <DialogHeader className="shrink-0 border-b border-border/70 bg-card/80 px-4 py-3 pe-14 text-card-foreground backdrop-blur sm:px-5 sm:py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-base font-black text-foreground sm:text-lg">{title}</DialogTitle>
            {headerExtra}
          </div>
          {description ? <DialogDescription className="mt-0.5 max-w-3xl text-xs font-medium leading-5 text-muted-foreground sm:text-sm sm:leading-6">{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody data-entity-form-scroll className="px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5 sm:pb-5 sm:pt-4">{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export const EntityForm = Object.assign(Root, { Root, Field, Section, ErrorSummary, Actions, Overlay });
