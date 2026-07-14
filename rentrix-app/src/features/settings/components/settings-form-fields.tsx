import { useId, type ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsValidationErrors,
} from '../settingsForm';

type BaseFieldProps = Readonly<{
  label: string;
  field: CompanySettingsDraftField;
  draft: CompanySettingsDraft;
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
    <label htmlFor={inputId} className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <Input
        id={inputId}
        type={type}
        inputMode={inputMode}
        value={draft[field]}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
      />
      {isInvalid ? <span id={errorId} className="block text-xs text-destructive" role="alert">{errors[field]}</span> : null}
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
    <label htmlFor={selectId} className="space-y-1 text-sm font-medium text-foreground">
      <span>{label}</span>
      <Select
        id={selectId}
        value={draft[field]}
        disabled={disabled}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(field, event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
      {isInvalid ? <span id={errorId} className="block text-xs text-destructive" role="alert">{errors[field]}</span> : null}
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
    <div className="rounded-xl border bg-background/70 p-3">
      <dt className="text-[11px] font-bold text-muted-foreground">{label}</dt>
      <dd className={muted ? 'mt-1 text-sm text-muted-foreground' : 'mt-1 text-sm font-semibold text-foreground'}>
        {value}
      </dd>
    </div>
  );
}
