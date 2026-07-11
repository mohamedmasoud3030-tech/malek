import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { RouteLoadingState } from '@/components/loading-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { EntityForm } from '@/components/ui/entity-form';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useBeforeUnloadGuard, useSubmitGuard } from '@/hooks/use-unsaved-changes-guard';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { personSchema, personTypeLabels, personTypeValues, type PersonFormValues } from './person-schema';
import { useCreatePerson, usePerson, useUpdatePerson } from './use-people';

function fieldError(message?: string) {
  return message ? <p className="text-xs font-bold text-destructive">{message}</p> : null;
}

interface PersonFormModalProps {
  open: boolean;
  onClose: () => void;
  personId?: string;
  defaultType?: 'tenant' | 'owner' | 'contact';
}

export function PersonFormModal({ open, onClose, personId, defaultType = 'tenant' }: PersonFormModalProps) {
  const isEdit = Boolean(personId);
  const personQuery = usePerson(personId ?? '');
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson(personId ?? '');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const { busy: isSubmittingGuard, run: runSubmit } = useSubmitGuard();
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      national_id: '',
      type: defaultType,
      address: '',
      notes: '',
    },
  });

  useBeforeUnloadGuard(form.formState.isDirty && open);

  useEffect(() => {
    if (!open) {
      form.reset({ full_name: '', phone: '', email: '', national_id: '', type: defaultType, address: '', notes: '' });
      setSubmitError(null);
      return;
    }
    if (personQuery.data) {
      form.reset({
        full_name: personQuery.data.full_name,
        phone: personQuery.data.phone ?? '',
        email: personQuery.data.email ?? '',
        national_id: personQuery.data.national_id ?? '',
        type: personQuery.data.type,
        address: personQuery.data.address ?? '',
        notes: personQuery.data.notes ?? '',
      });
    }
  }, [form, personQuery.data, open, defaultType]);

  const isMutationPending = createMutation.isPending || updateMutation.isPending;
  const isSubmitting = isSubmittingGuard || isMutationPending;

  const handleSubmit = form.handleSubmit(async (values) => {
    await runSubmit(async () => {
      setSubmitError(null);
      const payload = personSchema.parse(values);
      try {
        if (isEdit && personId) {
          await updateMutation.mutateAsync(payload);
        } else {
          await createMutation.mutateAsync(payload);
        }
        // Clear dirty state before closing so the guard does not block.
        form.reset(undefined, { keepValues: true });
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ بيانات الشخص. تحقق من الصلاحيات وحاول مرة أخرى.');
      }
    });
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || isSubmitting) {
      return;
    }

    if (form.formState.isDirty) {
      setShowDiscardDialog(true);
      return;
    }

    onClose();
  };

  const handleConfirmDiscard = () => {
    if (isSubmitting) {
      return;
    }

    setShowDiscardDialog(false);
    form.reset(undefined, { keepValues: true });
    onClose();
  };

  const handleCancelDiscard = () => {
    if (isSubmitting) {
      return;
    }

    setShowDiscardDialog(false);
  };

  const title = isEdit ? 'تعديل شخص' : (defaultType === 'owner' ? 'إضافة مالك' : 'إضافة شخص');

  return (
    <>
      <EntityForm.Overlay
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        className="max-w-2xl"
        headerExtra={form.formState.isDirty && !isSubmitting ? <StatusBadge tone="gold">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}
      >
        {isEdit && personQuery.isLoading ? (
          <RouteLoadingState />
        ) : (
          <EntityForm.Root className="md:grid-cols-2" onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />
            <label className="grid gap-2 text-sm font-bold">
              الاسم الكامل
              <Input {...form.register('full_name')} autoFocus />
              {fieldError(form.formState.errors.full_name?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              النوع
              <Select {...form.register('type')}>
                {personTypeValues.map((type) => (
                  <option key={type} value={type}>{personTypeLabels[type]}</option>
                ))}
              </Select>
              {fieldError(form.formState.errors.type?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              الهاتف
              <Input {...form.register('phone')} dir="ltr" />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              البريد الإلكتروني
              <Input {...form.register('email')} dir="ltr" />
              {fieldError(form.formState.errors.email?.message)}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              رقم الهوية
              <Input {...form.register('national_id')} />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              العنوان
              <Input {...form.register('address')} />
            </label>
            <label className="grid gap-2 text-sm font-bold md:col-span-2">
              ملاحظات
              <Textarea {...form.register('notes')} />
            </label>
            <EntityForm.Actions className="md:col-span-2" onCancel={() => handleOpenChange(false)} isSubmitting={isSubmitting} submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ'} />
          </EntityForm.Root>
        )}
      </EntityForm.Overlay>

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={(open) => { if (!open) handleCancelDiscard(); }}
        title="تغييرات غير محفوظة"
        description="هناك تغييرات لم تحفظ. إذا غادرت الآن سوف تفقد هذه التغييرات."
        confirmLabel="تجاهل التغييرات"
        cancelLabel="مواصلة التعديل"
        variant="warning"
        onConfirm={handleConfirmDiscard}
      />
    </>
  );
}
