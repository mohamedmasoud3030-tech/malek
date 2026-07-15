import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { propertyStatusLabels, propertyStatusValues } from '../property-schema';

/**
 * Common property form fields shared between create and edit modals.
 * Renders: title, type, address, status, purchase_value, current_value, notes.
 *
 * Uses generic register/errors to work with different form schemas
 * (create-with-agreement vs edit-only).
 */
export function PropertyFormCoreFields({
  register,
  errors,
}: Readonly<{
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
}>) {
  const err = errors as Record<string, { message?: string } | undefined>;
  return (
    <>
      <EntityForm.Field label="اسم العقار" error={err.title?.message}>
        <Input {...register('title')} placeholder="مثال: عمارة الندى" autoFocus />
      </EntityForm.Field>
      <EntityForm.Field label="نوع العقار" error={err.type?.message}>
        <Input {...register('type')} placeholder="سكني، تجاري، أرض..." />
      </EntityForm.Field>
      <EntityForm.Field label="العنوان" className="md:col-span-2" error={err.address?.message}>
        <Input {...register('address')} placeholder="المدينة، الحي، الشارع" />
      </EntityForm.Field>
      <EntityForm.Field label="الحالة" error={err.status?.message}>
        <Select {...register('status')}>
          {propertyStatusValues.map((s) => <option key={s} value={s}>{propertyStatusLabels[s]}</option>)}
        </Select>
      </EntityForm.Field>
      <EntityForm.Field label="قيمة الشراء" error={err.purchase_value?.message}>
        <Input type="number" step="0.01" inputMode="decimal" min="0" {...register('purchase_value')} />
      </EntityForm.Field>
      <EntityForm.Field label="القيمة الحالية" error={err.current_value?.message}>
        <Input type="number" step="0.01" inputMode="decimal" min="0" {...register('current_value')} />
      </EntityForm.Field>
      <EntityForm.Field label="ملاحظات" className="md:col-span-2">
        <Textarea {...register('notes')} placeholder="أي تفاصيل إضافية" />
      </EntityForm.Field>
    </>
  );
}
