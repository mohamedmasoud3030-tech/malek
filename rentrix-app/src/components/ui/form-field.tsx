import type { ReactNode } from 'react';
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
  const describedBy = error ? `${htmlFor ?? label}-error` : hint ? `${htmlFor ?? label}-hint` : undefined;

  return (
    <div className={cn('grid gap-1.5', wide && 'md:col-span-2', className)}>
      <label htmlFor={htmlFor} className="text-sm font-bold text-foreground">
        {label}
        {required ? <span className="ms-1 text-destructive" aria-hidden="true">*</span> : null}
      </label>
      <div aria-describedby={describedBy}>{children}</div>
      {error ? (
        <p id={`${htmlFor ?? label}-error`} className="text-xs font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={`${htmlFor ?? label}-hint`} className="text-xs font-bold text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
