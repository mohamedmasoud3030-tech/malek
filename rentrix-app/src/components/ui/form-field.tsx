import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils';

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
};

/**
 * Shared form field shell: label + control + error/hint messaging.
 * Wrap Input/Select/Textarea/DatePicker for consistent validation UX.
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
  className,
  wide = false,
}: FormFieldProps) {
  const generatedId = useId();
  const messageId = `${htmlFor ?? generatedId}-${error ? 'error' : 'hint'}`;
  const describedBy = error || hint ? messageId : undefined;

  /*
   * Accessibility contract (WCAG 1.3.1 / 3.3.1 / 3.3.3 / 4.1.2).
   *
   * Two defects are corrected here:
   *
   *  1. `aria-describedby` was set on the wrapping <div>, which is not the
   *     labelled element, so the error/hint was never announced.
   *  2. `htmlFor` is optional, and several call sites omit it — leaving the
   *     visible <label> bound to nothing and the control unnamed.
   *
   * The single child is therefore cloned to carry the association: the label's
   * `for` target is an id this component owns when the caller did not supply
   * one, plus `aria-describedby`, `aria-invalid` and `aria-required`. Every
   * attribute defers to an explicit value already present on the child, so
   * call sites keep full control.
   */
  const onlyChild = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const controlElement = isValidElement(onlyChild) ? (onlyChild as ReactElement<Record<string, unknown>>) : null;
  const childProps = (controlElement?.props ?? {}) as Record<string, unknown>;

  const controlId = htmlFor ?? (childProps.id as string | undefined) ?? `${generatedId}-control`;

  const control = controlElement
    ? cloneElement(controlElement, {
        id: controlId,
        'aria-describedby':
          [childProps['aria-describedby'] as string | undefined, describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': childProps['aria-invalid'] ?? (error ? true : undefined),
        'aria-required': childProps['aria-required'] ?? (required ? true : undefined),
      })
    : children;

  return (
    <div className={cn('grid gap-1.5', wide && 'md:col-span-2', className)}>
      <label htmlFor={controlElement ? controlId : htmlFor} className="text-sm font-bold text-foreground">
        {label}
        {required ? <span className="ms-1 text-destructive" aria-hidden="true">*</span> : null}
      </label>
      {control}
      {error ? (
        <p id={messageId} className="text-xs font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={messageId} className="text-xs font-bold text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
