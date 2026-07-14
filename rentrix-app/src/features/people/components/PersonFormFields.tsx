import type { UseFormReturn } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { personTypeLabels, personTypeValues, type PersonFormValues } from '../person-schema';

type PersonFormFieldsProps = Readonly<{
  form: UseFormReturn<PersonFormValues>;
  autoFocusName?: boolean;
}>;

export function PersonFormFields({ form, autoFocusName = false }: PersonFormFieldsProps) {
  return (
    <>
      <EntityForm.Field label="الاسم الكامل" error={form.formState.errors.full_name?.message}>
        <Input {...form.register('full_name')} autoFocus={autoFocusName} />
      </EntityForm.Field>
      <EntityForm.Field label="النوع" error={form.formState.errors.type?.message}>
        <Select {...form.register('type')}>
          {personTypeValues.map((type) => (
            <option key={type} value={type}>{personTypeLabels[type]}</option>
          ))}
        </Select>
      </EntityForm.Field>
      <EntityForm.Field label="الهاتف" error={form.formState.errors.phone?.message}>
        <Input {...form.register('phone')} dir="ltr" />
      </EntityForm.Field>
      <EntityForm.Field label="البريد الإلكتروني" error={form.formState.errors.email?.message}>
        <Input {...form.register('email')} dir="ltr" />
      </EntityForm.Field>
      <EntityForm.Field label="رقم الهوية" error={form.formState.errors.national_id?.message}>
        <Input {...form.register('national_id')} />
      </EntityForm.Field>
      <EntityForm.Field label="العنوان">
        <Input {...form.register('address')} />
      </EntityForm.Field>
      <EntityForm.Field label="ملاحظات" className="md:col-span-2">
        <Textarea {...form.register('notes')} />
      </EntityForm.Field>
    </>
  );
}
