import type { FieldValues, FieldErrors, UseFormRegister, Path } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { propertyStatusLabels, propertyStatusValues } from '../property-schema';

/**
 * Core property fields that both create (with agreement) and edit schemas share.
 *
 * The generic `T extends FieldValues` ensures the caller passes its own form
 * value type, so `register('title')` / `errors.title` are fully type-checked
 * against the caller's schema — no `as unknown as` casts required.
 *
 * Both schemas must contain at least these keys: title, type, address,
 * status, purchase_value, current_value, notes.
 */
export function PropertyFormCoreFields<T extends FieldValues>({
  register,
  errors,
}: Readonly<{
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}>) {
  return (
    <>
      <EntityForm.Field label="اسم العقار" error={errors.title?.message as string | undefined}>
        <Input {...register('title' as Path<T>)} placeholder="مثال: عمارة الندى" autoFocus />
      </EntityForm.Field>
      <EntityForm.Field label="نوع العقار" error={errors.type?.message as string | undefined}>
        <Input {...register('type' as Path<T>)} placeholder="سكني، تجاري، أرض..." />
      </EntityForm.Field>
      <EntityForm.Field label="العنوان" className="md:col-span-2" error={errors.address?.message as string | undefined}>
        <Input {...register('address' as Path<T>)} placeholder="المدينة، الحي، الشارع" />
      </EntityForm.Field>
      <EntityForm.Field label="الحالة" error={errors.status?.message as string | undefined}>
        <Select {...register('status' as Path<T>)}>
          {propertyStatusValues.map((s) => <option key={s} value={s}>{propertyStatusLabels[s]}</option>)}
        </Select>
      </EntityForm.Field>
      <EntityForm.Field label="قيمة الشراء" error={errors.purchase_value?.message as string | undefined}>
        <Input type="number" step="0.01" inputMode="decimal" min="0" {...register('purchase_value' as Path<T>)} />
      </EntityForm.Field>
      <EntityForm.Field label="القيمة الحالية" error={errors.current_value?.message as string | undefined}>
        <Input type="number" step="0.01" inputMode="decimal" min="0" {...register('current_value' as Path<T>)} />
      </EntityForm.Field>
      <EntityForm.Field label="ملاحظات" className="md:col-span-2">
        <Textarea {...register('notes' as Path<T>)} placeholder="أي تفاصيل إضافية" />
      </EntityForm.Field>
    </>
  );
}
