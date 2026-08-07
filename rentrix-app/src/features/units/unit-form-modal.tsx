import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useProperties } from '@/features/properties/use-properties';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import type { Unit } from '@/types/domain';
import {
  isUnitOperationallyManagedStatus,
  unitManualStatusValues,
  unitSchema,
  unitStatusLabels,
  type UnitFormValues,
} from './unit-schema';
import { useCreateUnit, useUpdateUnit } from './use-units';

type UnitFormModalProps = {
  propertyId: string;
  unit: Unit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UnitFormModal({ propertyId, unit, open, onOpenChange }: UnitFormModalProps) {
  const propertiesQuery = useProperties({ page: 1, pageSize: 500, search: '', status: 'all' });
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId);
  const effectivePropertyId = unit?.property_id ?? selectedPropertyId;
  const createMutation = useCreateUnit(effectivePropertyId);
  const updateMutation = useUpdateUnit(effectivePropertyId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const managedStatus = unit ? isUnitOperationallyManagedStatus(unit.status) : false;
  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema, undefined, { raw: true }),
    defaultValues: {
      unit_number: '',
      floor: '',
      status: 'available',
      rent_amount: null,
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      setSelectedPropertyId(unit?.property_id ?? propertyId);
      form.reset({
        unit_number: unit?.unit_number ?? '',
        floor: unit?.floor ?? '',
        status: unit?.status ?? 'available',
        rent_amount: unit?.rent_amount ?? null,
        notes: unit?.notes ?? '',
      });
    }
  }, [form, open, propertyId, unit]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  let propertyError: string | undefined;
  if (!selectedPropertyId) {
    propertyError = 'اختيار العقار مطلوب';
  } else if (propertiesQuery.isError) {
    propertyError = 'تعذر تحميل العقارات. أعد المحاولة قبل الحفظ.';
  }

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={onOpenChange}
      title={unit ? 'تعديل وحدة' : 'إضافة وحدة'}
      description="أدخل بيانات الوحدة الأساسية. حالتا الإشغال والصيانة تُحدّثان تلقائياً من العقود وطلبات الصيانة."
      className="max-w-2xl"
      mobileSurface="bottom-sheet"
      visualVariant="operational"
      headerExtra={
        form.formState.isDirty && !isSubmitting ? (
          <StatusBadge tone="warning">
            {translateSharedLabel('unsavedChanges', getAppLanguageState().language)}
          </StatusBadge>
        ) : undefined
      }
    >
      <EntityForm.Root
        className="md:grid-cols-2"
        aria-busy={isSubmitting}
        onSubmit={form.handleSubmit(
          async (values) => {
            setSubmitError(null);
            try {
              const payload = unitSchema.parse(values);
              if (unit) {
                await updateMutation.mutateAsync({ unitId: unit.id, payload });
              } else {
                if (!effectivePropertyId) {
                  setSubmitError('اختر العقار قبل حفظ الوحدة.');
                  return;
                }
                await createMutation.mutateAsync(payload);
              }
              onOpenChange(false);
            } catch (error) {
              setSubmitError(
                error instanceof Error
                  ? error.message
                  : 'تعذر حفظ الوحدة. تحقق من الصلاحيات ثم أعد المحاولة.',
              );
            }
          },
          () => {
            setSubmitError('راجع الحقول المعلّمة ثم اضغط حفظ الوحدة مرة أخرى.');
          },
        )}
      >
        {!unit ? (
          <EntityForm.Field label="العقار" className="md:col-span-2" error={propertyError}>
            <Select
              value={selectedPropertyId}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
              disabled={propertiesQuery.isLoading}
              aria-invalid={!selectedPropertyId}
            >
              <option value="">اختر العقار</option>
              {(propertiesQuery.data?.rows ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
        ) : null}

        <EntityForm.Field label="رقم الوحدة" error={form.formState.errors.unit_number?.message}>
          <Input {...form.register('unit_number')} />
        </EntityForm.Field>

        <EntityForm.Field label="الدور">
          <Input {...form.register('floor')} />
        </EntityForm.Field>

        <EntityForm.Field label="الحالة">
          {managedStatus && unit ? (
            <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
              <input type="hidden" {...form.register('status')} />
              <StatusBadge tone={unit.status === 'occupied' ? 'success' : 'warning'}>
                {unitStatusLabels[unit.status]}
              </StatusBadge>
              <p className="text-xs leading-5 text-muted-foreground">
                هذه الحالة مرتبطة {unit.status === 'occupied' ? 'بعقد نشط' : 'بطلب صيانة مفتوح'} وتتغير تلقائياً عند تغيره.
              </p>
            </div>
          ) : (
            <Select {...form.register('status')}>
              {unitManualStatusValues.map((status) => (
                <option key={status} value={status}>
                  {unitStatusLabels[status]}
                </option>
              ))}
            </Select>
          )}
        </EntityForm.Field>

        <EntityForm.Field label="قيمة الإيجار الافتراضية" error={form.formState.errors.rent_amount?.message}>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            min="0"
            {...form.register('rent_amount')}
          />
        </EntityForm.Field>

        <EntityForm.Field label="ملاحظات" className="md:col-span-2">
          <Textarea {...form.register('notes')} />
        </EntityForm.Field>

        <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />

        <EntityForm.Actions
          className="md:col-span-2"
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
          submitDisabled={
            !unit && (!effectivePropertyId || propertiesQuery.isLoading || propertiesQuery.isError)
          }
          submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ الوحدة'}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
