import { useId, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsValidationErrors,
} from '../settingsForm';

/**
 * Shared form primitives for the Settings workspace (WP-D `form/` machinery).
 *
 * `draft` is intentionally a partial view: section components pass the
 * section-scoped slice produced by `useSettingsSection`, so these primitives
 * never need the monolithic whole-record draft. Passing the full draft (as
 * compatibility callers do) keeps working — `Partial` accepts it.
 */
type BaseFieldProps = Readonly<{
  label: string;
  field: CompanySettingsDraftField;
  draft: Readonly<Partial<CompanySettingsDraft>>;
  errors: CompanySettingsValidationErrors;
  disabled: boolean;
  onChange: (field: CompanySettingsDraftField, value: string) => void;
}>;

type FormFieldProps = BaseFieldProps & Readonly<{
  placeholder?: string;
  type?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
}>;

export function FormField({ label, field, draft, errors, disabled, placeholder, type = 'text', inputMode, onChange }: FormFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const isInvalid = Boolean(errors[field]);
  return (
    <label htmlFor={inputId} className="block min-w-0 space-y-1 text-xs font-bold text-foreground">
      <span className="block px-0.5">{label}</span>
      <Input
        id={inputId}
        type={type}
        inputMode={inputMode}
        value={draft[field] ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
        className="min-h-11 rounded-lg px-3 text-sm"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
      />
      {isInvalid ? <span id={errorId} className="block px-0.5 text-[11px] text-destructive" role="alert">{errors[field]}</span> : null}
    </label>
  );
}

type SelectFieldProps = BaseFieldProps & Readonly<{
  options: readonly string[];
}>;

export function SelectField({ label, field, draft, errors, disabled, options, onChange }: SelectFieldProps) {
  const selectId = useId();
  const errorId = `${selectId}-error`;
  const isInvalid = Boolean(errors[field]);
  return (
    <label htmlFor={selectId} className="block min-w-0 space-y-1 text-xs font-bold text-foreground">
      <span className="block px-0.5">{label}</span>
      <Select
        id={selectId}
        value={draft[field] ?? ''}
        disabled={disabled}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
        className="min-h-11 rounded-lg px-3 text-sm"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(field, event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
      {isInvalid ? <span id={errorId} className="block px-0.5 text-[11px] text-destructive" role="alert">{errors[field]}</span> : null}
    </label>
  );
}

type PreviewFieldProps = Readonly<{
  label: string;
  value: string;
  muted?: boolean;
}>;

export function PreviewField({ label, value, muted = false }: PreviewFieldProps) {
  return (
    <div className="rounded-lg border bg-background/70 p-2.5 sm:rounded-xl sm:p-3">
      <dt className="text-[11px] font-bold text-muted-foreground sm:text-xs">{label}</dt>
      <dd className={muted ? 'mt-0.5 text-sm text-muted-foreground' : 'mt-0.5 text-sm font-semibold text-foreground'}>
        {value}
      </dd>
    </div>
  );
}
