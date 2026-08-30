import { type ChangeEvent } from 'react';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type {
  CompanySettingsDraft,
  CompanySettingsDraftField,
  CompanySettingsValidationErrors,
} from '../settingsForm';

/**
 * Settings field adapters (WP-D `form/` machinery).
 *
 * These are thin domain adapters: they map the settings draft/field model
 * onto the canonical field shell (`EntityForm.Field`) so label/help/error/
 * required composition and its ARIA wiring have exactly one owner. Only the
 * `draft` → control value binding is settings-specific.
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

type SettingsFormFieldProps = BaseFieldProps & Readonly<{
  placeholder?: string;
  type?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
}>;

export function SettingsFormField({ label, field, draft, errors, disabled, placeholder, type = 'text', inputMode, onChange }: SettingsFormFieldProps) {
  const isInvalid = Boolean(errors[field]);
  return (
    <EntityForm.Field label={label} error={isInvalid ? errors[field] : undefined}>
      <Input
        type={type}
        inputMode={inputMode}
        value={draft[field] ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-11 rounded-lg px-3 text-sm"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
      />
    </EntityForm.Field>
  );
}

type SettingsSelectFieldProps = BaseFieldProps & Readonly<{
  options: readonly string[];
}>;

export function SettingsSelectField({ label, field, draft, errors, disabled, options, onChange }: SettingsSelectFieldProps) {
  const isInvalid = Boolean(errors[field]);
  return (
    <EntityForm.Field label={label} error={isInvalid ? errors[field] : undefined}>
      <Select
        value={draft[field] ?? ''}
        disabled={disabled}
        className="min-h-11 rounded-lg px-3 text-sm"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(field, event.target.value)}
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </Select>
    </EntityForm.Field>
  );
}

type SettingsPreviewFieldProps = Readonly<{
  label: string;
  value: string;
  muted?: boolean;
}>;

export function SettingsPreviewField({ label, value, muted = false }: SettingsPreviewFieldProps) {
  return (
    <div className="rounded-lg border bg-background/70 p-2.5 sm:rounded-xl sm:p-3">
      <dt className="text-[11px] font-bold text-muted-foreground sm:text-xs">{label}</dt>
      <dd className={muted ? 'mt-0.5 text-sm text-muted-foreground' : 'mt-0.5 text-sm font-semibold text-foreground'}>
        {value}
      </dd>
    </div>
  );
}
