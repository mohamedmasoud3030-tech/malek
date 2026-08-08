/*
 * ============================================
 * MALIK PRO - Form Components
 * Input, Select, Textarea with consistent styling
 * ============================================
 */

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Input Component ──
export interface MalikInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export function MalikInput({
  error,
  label,
  hint,
  className,
  id,
  ...props
}: MalikInputProps) {
  const inputId = id || props.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          data-malik-label
          className={cn(props.required && 'data-malik-label-required')}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        data-malik-input
        className={cn(
          error && 'data-malik-input-error',
          className
        )}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} data-malik-error role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-[hsl(var(--malik-foreground-muted))]">
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Select Component ──
export interface MalikSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export function MalikSelect({
  error,
  label,
  options,
  placeholder,
  className,
  id,
  ...props
}: MalikSelectProps) {
  const selectId = id || props.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          data-malik-label
          className={cn(props.required && 'data-malik-label-required')}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        data-malik-input
        data-malik-select
        className={cn(
          error && 'data-malik-input-error',
          className
        )}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p data-malik-error role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Textarea Component ──
export interface MalikTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export function MalikTextarea({
  error,
  label,
  hint,
  className,
  id,
  ...props
}: MalikTextareaProps) {
  const textareaId = id || props.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          data-malik-label
          className={cn(props.required && 'data-malik-label-required')}
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        data-malik-input
        className={cn(
          'min-h-[120px] resize-y',
          error && 'data-malik-input-error',
          className
        )}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {error && (
        <p data-malik-error role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-[hsl(var(--malik-foreground-muted))]">
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Checkbox Component ──
export interface MalikCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function MalikCheckbox({
  label,
  description,
  className,
  id,
  ...props
}: MalikCheckboxProps) {
  const checkboxId = id || props.name;

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        'flex items-start gap-3 cursor-pointer',
        'p-3 rounded-lg border border-[hsl(var(--malik-border))]',
        'bg-[hsl(var(--malik-card))]',
        'hover:border-[hsl(var(--malik-primary)/0.4)]',
        'transition-colors duration-150',
        props.disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input
        type="checkbox"
        id={checkboxId}
        className="mt-1 size-4 rounded border-[hsl(var(--malik-border))] text-[hsl(var(--malik-primary))] focus:ring-[hsl(var(--malik-primary))]"
        {...props}
      />
      <div className="flex-1">
        <span className="block text-sm font-medium text-[hsl(var(--malik-foreground))]">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-[hsl(var(--malik-foreground-muted))]">
            {description}
          </span>
        )}
      </div>
    </label>
  );
}

// ── Radio Group Component ──
export interface MalikRadioOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface MalikRadioGroupProps {
  name: string;
  label?: string;
  options: MalikRadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

export function MalikRadioGroup({
  name,
  label,
  options,
  value,
  onChange,
  error,
}: MalikRadioGroupProps) {
  return (
    <fieldset className="space-y-2">
      {label && (
        <legend data-malik-label className="mb-2">
          {label}
        </legend>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer',
              'transition-all duration-150',
              value === option.value
                ? 'border-[hsl(var(--malik-primary))] bg-[hsl(var(--malik-primary-soft))]'
                : 'border-[hsl(var(--malik-border))] bg-[hsl(var(--malik-card))]',
              'hover:border-[hsl(var(--malik-primary)/0.4)]'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              className="sr-only"
            />
            {option.icon && (
              <div className="flex items-center justify-center size-10 rounded-lg bg-[hsl(var(--malik-muted))]">
                {option.icon}
              </div>
            )}
            <div className="flex-1">
              <span className="block text-sm font-bold text-[hsl(var(--malik-foreground))]">
                {option.label}
              </span>
              {option.description && (
                <span className="block text-xs text-[hsl(var(--malik-foreground-muted))]">
                  {option.description}
                </span>
              )}
            </div>
            <div
              className={cn(
                'size-5 rounded-full border-2 flex items-center justify-center',
                value === option.value
                  ? 'border-[hsl(var(--malik-primary))] bg-[hsl(var(--malik-primary))]'
                  : 'border-[hsl(var(--malik-border))]'
              )}
            >
              {value === option.value && (
                <div className="size-2 rounded-full bg-white" />
              )}
            </div>
          </label>
        ))}
      </div>
      {error && (
        <p data-malik-error role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ── Form Grid Layout ──
export function MalikFormGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-malik-form-grid
      className={cn('grid gap-4', className)}
    >
      {children}
    </div>
  );
}

// ── Form Section ──
export function MalikFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl border border-[hsl(var(--malik-border-light))]',
        'bg-gradient-to-b from-[hsl(var(--malik-card))] to-[hsl(var(--malik-muted)/0.3)]',
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[hsl(var(--malik-foreground))]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-[hsl(var(--malik-foreground-muted))]">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
