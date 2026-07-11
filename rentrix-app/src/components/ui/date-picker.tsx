import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type DatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  error?: string;
  hint?: string;
};

/**
 * Native date input with consistent product styling and optional label/error.
 * Uses type="date" for mobile-native pickers and RTL-friendly layout.
 */
export function DatePicker({
  label,
  error,
  hint,
  className,
  id,
  disabled,
  ...props
}: DatePickerProps) {
  const inputId = id ?? props.name;

  return (
    <label className={cn('grid gap-1.5 text-sm font-bold', disabled && 'opacity-60')} htmlFor={inputId}>
      {label ? <span className="text-foreground">{label}</span> : null}
      <input
        id={inputId}
        type="date"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          'min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold text-foreground outline-none transition',
          'focus-visible:ring-4 focus-visible:ring-primary/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive/20',
          className,
        )}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-xs font-bold text-destructive" role="alert">
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${inputId}-hint`} className="text-xs font-bold text-muted-foreground">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
