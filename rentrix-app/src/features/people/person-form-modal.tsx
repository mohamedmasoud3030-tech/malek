import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { RouteLoadingState } from '@/components/loading-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityForm } from '@/components/ui/entity-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { useBeforeUnloadGuard, useSubmitGuard } from '@/hooks/use-unsaved-changes-guard';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { PersonFormFields } from './components/PersonFormFields';
import { personSchema, type PersonFormValues } from './person-schema';
import { useCreatePerson, usePerson, useUpdatePerson } from './use-people';

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
    resolver: zodResolver(personSchema, undefined, { raw: true }),
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
      try {
        const payload = personSchema.parse(values);
        if (isEdit && personId) {
          await updateMutation.mutateAsync(payload);
        } else {
          await createMutation.mutateAsync(payload);
        }
        form.reset(undefined, { keepValues: true });
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ بيانات الشخص. تحقق من الصلاحيات وحاول مرة أخرى.');
      }
    });
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || isSubmitting) return;
    if (form.formState.isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    if (isSubmitting) return;
    setShowDiscardDialog(false);
    form.reset(undefined, { keepValues: true });
    onClose();
  };

  const handleCancelDiscard = () => {
    if (!isSubmitting) setShowDiscardDialog(false);
  };

  const title = isEdit ? 'تعديل شخص' : (defaultType === 'owner' ? 'إضافة مالك' : 'إضافة شخص');
  const description = defaultType === 'owner'
    ? 'سجّل بيانات المالك الأساسية والتواصل والهوية في نموذج واحد.'
    : defaultType === 'tenant'
      ? 'سجّل بيانات المستأجر الأساسية والتواصل والهوية في نموذج واحد.'
      : 'سجّل بيانات الشخص والتواصل والهوية في نموذج واحد.';

  return (
    <>
      <EntityForm.Overlay
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        className="max-w-2xl"
        headerExtra={form.formState.isDirty && !isSubmitting ? (
          <StatusBadge tone="warning">
            {translateSharedLabel('unsavedChanges', getAppLanguageState().language)}
          </StatusBadge>
        ) : undefined}
      >
        {isEdit && personQuery.isLoading ? (
          <RouteLoadingState />
        ) : (
          <EntityForm.Root
            className="md:grid-cols-2"
            onSubmit={handleSubmit}
            aria-busy={isSubmitting}
          >
            <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />
            <PersonFormFields form={form} autoFocusName />
            <EntityForm.Actions
              className="md:col-span-2"
              onCancel={() => handleOpenChange(false)}
              isSubmitting={isSubmitting}
              submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ'}
            />
          </EntityForm.Root>
        )}
      </EntityForm.Overlay>

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) handleCancelDiscard();
        }}
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
