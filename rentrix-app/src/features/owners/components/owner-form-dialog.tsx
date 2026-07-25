import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import type { Owner } from '../services/owner-service';
import { useCreateOwner, useUpdateOwner } from '../useOwners';
import {
  emptyOwnerFormValues,
  ownerToFormValues,
  validateOwnerForm,
  validateOwnerFormFields,
  type OwnerFormValues,
} from '../utils/owner-ui-helpers';
import { OwnerCheckbox } from './owner-checkbox';

export type OwnerFormDialogProps = Readonly<{ owner: Owner | null; open: boolean; onOpenChange: (open: boolean) => void }>;

export function OwnerFormDialog({ owner, open, onOpenChange }: OwnerFormDialogProps) {
  const [values, setValues] = useState<OwnerFormValues>(emptyOwnerFormValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof OwnerFormValues, string>>>({});
  const createOwner = useCreateOwner();
  const updateOwner = useUpdateOwner(owner?.id ?? '');
  const isEditing = Boolean(owner);
  const isPending = createOwner.isPending || updateOwner.isPending;

  useEffect(() => {
    if (open) {
      setValues(ownerToFormValues(owner));
      setError(null);
      setFieldErrors({});
    }
  }, [open, owner]);

  const setField = <K extends keyof OwnerFormValues>(field: K, value: OwnerFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const initialValues = useMemo(() => ownerToFormValues(owner), [owner]);
  const isDirty = useMemo(() => Object.keys(initialValues).some((key) => {
    const field = key as keyof OwnerFormValues;
    return (initialValues[field] ?? '') !== (values[field] ?? '');
  }), [initialValues, values]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextFieldErrors = validateOwnerFormFields(values);
    const validationError = validateOwnerForm(values);
    setFieldErrors(nextFieldErrors);
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = {
      full_name: values.full_name,
      display_name: values.display_name,
      phone: values.phone,
      email: values.email,
      national_id: values.national_id,
      tax_number: values.tax_number,
      address: values.address,
      notes: values.notes,
      is_active: values.is_active,
    };
    try {
      if (owner) await updateOwner.mutateAsync(payload);
      else await createOwner.mutateAsync(payload);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر حفظ بيانات المالك. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'تعديل بيانات المالك' : 'إضافة مالك'}
      description="بيانات تعريفية خفيفة للملاك بدون إضافة أرصدة أو تسويات مالية."
      className="max-w-2xl"
      headerExtra={isDirty && !isPending ? <StatusBadge tone="warning">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}
    >
      <EntityForm.Root onSubmit={handleSubmit} aria-busy={isPending}>
        <EntityForm.ErrorSummary message={error} />
        <div className="grid gap-4 md:grid-cols-2">
          <EntityForm.Field label="اسم المالك *" error={fieldErrors.full_name}>
            <Input value={values.full_name} onChange={(event) => setField('full_name', event.target.value)} />
          </EntityForm.Field>
          <EntityForm.Field label="الاسم المختصر">
            <Input value={values.display_name} onChange={(event) => setField('display_name', event.target.value)} />
          </EntityForm.Field>
          <EntityForm.Field label="الهاتف" error={fieldErrors.phone}>
            <Input value={values.phone} onChange={(event) => setField('phone', event.target.value)} />
          </EntityForm.Field>
          <EntityForm.Field label="البريد الإلكتروني" error={fieldErrors.email}>
            <Input dir="ltr" value={values.email} onChange={(event) => setField('email', event.target.value)} />
          </EntityForm.Field>
          <EntityForm.Field label="الرقم المدني" error={fieldErrors.national_id}>
            <Input value={values.national_id} onChange={(event) => setField('national_id', event.target.value)} />
          </EntityForm.Field>
          <EntityForm.Field label="الرقم الضريبي">
            <Input value={values.tax_number} onChange={(event) => setField('tax_number', event.target.value)} />
          </EntityForm.Field>
        </div>
        <EntityForm.Field label="العنوان">
          <Textarea value={values.address} onChange={(event) => setField('address', event.target.value)} />
        </EntityForm.Field>
        <EntityForm.Field label="ملاحظات">
          <Textarea value={values.notes} onChange={(event) => setField('notes', event.target.value)} />
        </EntityForm.Field>
        <OwnerCheckbox checked={values.is_active} label="مالك نشط" onCheckedChange={(checked) => setField('is_active', checked)} />
        <EntityForm.Actions onCancel={() => onOpenChange(false)} isSubmitting={isPending} submitLabel={isEditing ? 'حفظ التعديلات' : 'إنشاء المالك'} />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}