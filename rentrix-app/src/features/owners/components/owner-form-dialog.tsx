import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { EntityForm } from '@/components/ui/entity-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { OwnerCheckbox } from './owner-checkbox';
import type { Owner } from '../services/owner-service';
import { useCreateOwner, useUpdateOwner } from '../useOwners';
import {
  emptyOwnerFormValues,
  ownerToFormValues,
  validateOwnerForm,
  validateOwnerFormFields,
  type OwnerFormValues,
} from '../utils/owner-ui-helpers';

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="text-xs font-bold text-destructive">{message}</p> : null;
}

export type OwnerFormDialogProps = Readonly<{ owner: Owner | null; open: boolean; onOpenChange: (open: boolean) => void }>;

/**
 * Create/edit dialog for owner identity fields (name, contact, notes,
 * active flag). Deliberately excludes any property-ownership or financial
 * data — those are handled by the separate ownership-link workflow.
 */
export function OwnerFormDialog({ owner, open, onOpenChange }: OwnerFormDialogProps) {
  const [values, setValues] = useState<OwnerFormValues>(emptyOwnerFormValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof OwnerFormValues, string>>>({});
  const createOwner = useCreateOwner();
  const updateOwner = useUpdateOwner(owner?.id ?? '');
  const isEditing = Boolean(owner);
  const isPending = createOwner.isPending || updateOwner.isPending;

  useEffect(() => {
    if (open) { setValues(ownerToFormValues(owner)); setError(null); setFieldErrors({}); }
  }, [open, owner]);

  const setField = <K extends keyof OwnerFormValues>(field: K, value: OwnerFormValues[K]) => {
    setValues((cur) => ({ ...cur, [field]: value }));
    setError(null);
    setFieldErrors((cur) => ({ ...cur, [field]: undefined }));
  };

  const initialValues = useMemo(() => ownerToFormValues(owner), [owner]);
  const isDirty = useMemo(() => {
    return Object.keys(initialValues).some((key) => {
      const field = key as keyof OwnerFormValues;
      return (initialValues[field] ?? '') !== (values[field] ?? '');
    });
  }, [initialValues, values]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextFieldErrors = validateOwnerFormFields(values);
    const validationError = validateOwnerForm(values);
    setFieldErrors(nextFieldErrors);
    if (validationError) { setError(validationError); return; }
    const payload = {
      full_name: values.full_name, display_name: values.display_name, phone: values.phone,
      email: values.email, national_id: values.national_id, tax_number: values.tax_number,
      address: values.address, notes: values.notes, is_active: values.is_active,
    };
    try {
      if (owner) await updateOwner.mutateAsync(payload);
      else await createOwner.mutateAsync(payload);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ بيانات المالك. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };

  return (
    <EntityForm.Overlay open={open} onOpenChange={onOpenChange} title={isEditing ? 'تعديل بيانات المالك' : 'إضافة مالك'} description="بيانات تعريفية خفيفة للملاك بدون إضافة أرصدة أو تسويات مالية." className="max-w-2xl" headerExtra={isDirty && !isPending ? <StatusBadge tone="gold">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}>
      <EntityForm.Root onSubmit={handleSubmit}>
        <EntityForm.ErrorSummary message={error} />
        <div className="grid gap-4 md:grid-cols-2">
          <EntityForm.Field label="اسم المالك *"><Input value={values.full_name} onChange={(e) => setField('full_name', e.target.value)} /><FieldError message={fieldErrors.full_name} /></EntityForm.Field>
          <EntityForm.Field label="الاسم المختصر"><Input value={values.display_name} onChange={(e) => setField('display_name', e.target.value)} /></EntityForm.Field>
          <EntityForm.Field label="الهاتف"><Input value={values.phone} onChange={(e) => setField('phone', e.target.value)} /><FieldError message={fieldErrors.phone} /></EntityForm.Field>
          <EntityForm.Field label="البريد الإلكتروني"><Input dir="ltr" value={values.email} onChange={(e) => setField('email', e.target.value)} /><FieldError message={fieldErrors.email} /></EntityForm.Field>
          <EntityForm.Field label="الرقم المدني"><Input value={values.national_id} onChange={(e) => setField('national_id', e.target.value)} /><FieldError message={fieldErrors.national_id} /></EntityForm.Field>
          <EntityForm.Field label="الرقم الضريبي"><Input value={values.tax_number} onChange={(e) => setField('tax_number', e.target.value)} /></EntityForm.Field>
        </div>
        <EntityForm.Field label="العنوان"><Textarea value={values.address} onChange={(e) => setField('address', e.target.value)} /></EntityForm.Field>
        <EntityForm.Field label="ملاحظات"><Textarea value={values.notes} onChange={(e) => setField('notes', e.target.value)} /></EntityForm.Field>
        <OwnerCheckbox checked={values.is_active} label="مالك نشط" onCheckedChange={(checked) => setField('is_active', checked)} />
        <EntityForm.Actions onCancel={() => onOpenChange(false)} isSubmitting={isPending} submitLabel={isEditing ? 'حفظ التعديلات' : 'إنشاء المالك'} />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
