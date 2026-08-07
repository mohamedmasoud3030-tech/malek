import { Loader2 } from 'lucide-react';
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { Input, inputVariants } from './input';
import { Textarea } from './textarea';

type FieldState = 'default' | 'error' | 'warning' | 'success';

type FieldShellProps = {
  id?: string;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  success?: ReactNode;
  required?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  trailingAction?: ReactNode;
  loading?: boolean;
  className?: string;
  children: (props: { id: string; state: FieldState; 'aria-describedby'?: string }) => ReactNode;
};

function resolveState(error?: ReactNode, warning?: ReactNode, success?: ReactNode): FieldState {
  if (error) return 'error';
  if (warning) return 'warning';
  if (success) return 'success';
  return 'default';
}

/** Shared label + description + message shell used by TextField/TextAreaField. */
export function FieldShell({
  id,
  label,
  description,
  error,
  warning,
  success,
  required,
  leadingIcon,
  trailingIcon,
  trailingAction,
  loading,
  className,
  children,
}: FieldShellProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const warningId = warning && !error ? `${controlId}-warning` : undefined;
  const successId = success && !error && !warning ? `${controlId}-success` : undefined;
  const describedBy = [descriptionId, errorId, warningId, successId].filter(Boolean).join(' ') || undefined;
  const state = resolveState(error, warning, success);

  const hasAffix = Boolean(leadingIcon || trailingIcon || trailingAction || loading);

  const message = error ?? warning ?? success;
  const messageTone =
    state === 'error'
      ? 'text-destructive'
      : state === 'warning'
        ? 'text-warning'
        : state === 'success'
          ? 'text-success'
          : 'text-muted-foreground';

  return (
    <div className={cn('grid gap-1.5', className)}>
      {label ? (
        <label htmlFor={controlId} className="text-sm font-bold text-foreground">
          {label}
          {required ? <span className="ms-1 text-destructive" aria-hidden="true">*</span> : null}
        </label>
      ) : null}

      {hasAffix ? (
        <div className="relative">
          {leadingIcon ? (
            <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted-foreground">
              {leadingIcon}
            </span>
          ) : null}
          {children({
            id: controlId,
            state,
            'aria-describedby': describedBy,
          })}
          {loading ? (
            <span
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              <span className="sr-only">جارٍ التحميل...</span>
            </span>
          ) : trailingAction ? (
            <span className="absolute inset-y-0 end-1.5 grid place-items-center">{trailingAction}</span>
          ) : trailingIcon ? (
            <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-muted-foreground">
              {trailingIcon}
            </span>
          ) : null}
        </div>
      ) : (
        children({ id: controlId, state, 'aria-describedby': describedBy })
      )}

      {description && !message ? (
        <p id={descriptionId} className="text-xs font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
      {message ? (
        <p
          id={errorId ?? warningId ?? successId}
          role={state === 'error' ? 'alert' : 'status'}
          className={cn('text-xs font-semibold', messageTone)}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  success?: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  trailingAction?: ReactNode;
  loading?: boolean;
  /** Render a currency adornment. Use `inputMode="decimal"` for numeric input. */
  currency?: ReactNode;
};

/**
 * Composed text field wrapping the canonical `Input` with label, description,
 * validation messages, icons, and loading state. Supports text/email/password/
 * number/search/date — pass `currency` to show an end adornment.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    id,
    label,
    description,
    error,
    warning,
    success,
    leadingIcon,
    trailingIcon,
    trailingAction,
    loading,
    disabled,
    readOnly,
    currency,
    className,
    ...props
  },
  ref,
) {
  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      warning={warning}
      success={success}
      leadingIcon={leadingIcon}
      trailingIcon={currency ? undefined : trailingIcon}
      trailingAction={
        currency ? (
          <span className="pointer-events-none rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
            {currency}
          </span>
        ) : (
          trailingAction
        )
      }
      loading={loading}
    >
      {({ id: controlId, state, ...aria }) => (
        <Input
          ref={ref}
          id={controlId}
          state={state}
          disabled={disabled || loading}
          readOnly={readOnly}
          aria-invalid={state === 'error' || undefined}
          className={cn(
            leadingIcon && 'ps-10',
            (trailingIcon || loading || currency) && 'pe-10',
            className,
          )}
          {...aria}
          {...props}
        />
      )}
    </FieldShell>
  );
});

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  success?: ReactNode;
  loading?: boolean;
};

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { id, label, description, error, warning, success, loading, disabled, className, ...props },
  ref,
) {
  return (
    <FieldShell
      id={id}
      label={label}
      description={description}
      error={error}
      warning={warning}
      success={success}
      loading={loading}
    >
      {({ id: controlId, state, ...aria }) => (
        <Textarea
          ref={ref}
          id={controlId}
          disabled={disabled || loading}
          aria-invalid={state === 'error' || undefined}
          className={cn(
            inputVariants({ state }),
            'min-h-28 rounded-xl px-3 py-2 text-base sm:text-sm',
            className,
          )}
          {...aria}
          {...props}
        />
      )}
    </FieldShell>
  );
});

/** Convenience: controlled password field with a show/hide toggle. */
export const PasswordField = forwardRef<HTMLInputElement, TextFieldProps>(function PasswordField(
  { trailingAction, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      type={visible ? 'text' : 'password'}
      autoComplete={props.autoComplete ?? 'current-password'}
      trailingAction={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="touch-target grid size-9 place-items-center rounded-md text-xs font-bold text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        >
          {visible ? 'إخفاء' : 'إظهار'}
        </button>
      }
      {...props}
    />
  );
});
