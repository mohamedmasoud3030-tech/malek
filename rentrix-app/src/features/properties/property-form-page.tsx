import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DirtyRouteNavigationGuard, useBeforeUnloadGuard, useSubmitGuard } from '@/hooks/use-unsaved-changes-guard';
import { propertySchema, propertyStatusLabels, propertyStatusValues, type PropertyFormValues } from './property-schema';
import { PropertyFormModal } from './property-form-modal';
import { useProperty, useUpdateProperty } from './use-properties';

export function PropertyFormPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;
  return propertyId ? <PropertyEditFormPage propertyId={propertyId} /> : <PropertyCreateRoute />;
}

function PropertyCreateRoute() {
  const router = useRouter();

  return (
    <PropertyFormModal
      open
      onClose={() => {
        void router.navigate({ to: '/properties' });
      }}
    />
  );
}

function PropertyEditFormPage({ propertyId }: Readonly<{ propertyId: string }>) {
  const router = useRouter();
  const propertyQuery = useProperty(propertyId);
  const updateMutation = useUpdateProperty(propertyId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);
  const { busy: isSubmittingGuard, run: runSubmit } = useSubmitGuard();
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema, undefined, { raw: true }),
    defaultValues: {
      title: '',
      type: '',
      address: '',
      purchase_value: null,
      current_value: null,
      status: 'active',
      notes: '',
    },
  });

  useBeforeUnloadGuard(form.formState.isDirty);

  useEffect(() => {
    if (propertyQuery.data) {
      form.reset({
        title: propertyQuery.data.title,
        type: propertyQuery.data.type,
        address: propertyQuery.data.address,
        purchase_value: propertyQuery.data.purchase_value,
        current_value: propertyQuery.data.current_value,
        status: propertyQuery.data.status,
        notes: propertyQuery.data.notes ?? '',
      });
    }
  }, [form, propertyQuery.data]);

  const isSubmitting = isSubmittingGuard || updateMutation.isPending;
  const handleSubmit = form.handleSubmit(async (values) => {
    await runSubmit(async () => {
      setSubmitError(null);
      try {
        const payload = propertySchema.parse(values);
        await updateMutation.mutateAsync(payload);
        form.reset(undefined, { keepValues: true });
        await router.navigate({ to: '/properties' });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ العقار. تحقق من الصلاحيات ثم أعد المحاولة.');
      }
    });
  });

  const requestNavigate = async (to: string) => {
    if (isSubmitting) return;
    if (form.formState.isDirty) {
      setPendingNavigateTo(to);
      setShowDiscardDialog(true);
      return;
    }
    await router.navigate({ to });
  };

  const handleConfirmDiscard = async () => {
    setShowDiscardDialog(false);
    form.reset(undefined, { keepValues: true });
    if (pendingNavigateTo) {
      const navigateTo = pendingNavigateTo;
      setPendingNavigateTo(null);
      await router.navigate({ to: navigateTo });
    }
  };

  const handleCancelDiscard = () => {
    setShowDiscardDialog(false);
    setPendingNavigateTo(null);
  };

  if (propertyQuery.isLoading) return <RouteLoadingState />;
  if (propertyQuery.isError) {
    return (
      <PageLayout dir="rtl" lang="ar" contentClassName="max-w-3xl">
        <Card role="alert" aria-live="assertive">
          <CardHeader>
            <CardTitle>تعذر تحميل العقار للتعديل</CardTitle>
            <CardDescription>{propertyQuery.error instanceof Error ? propertyQuery.error.message : 'تحقق من الصلاحيات أو الاتصال ثم أعد المحاولة.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => propertyQuery.refetch()}>إعادة المحاولة</Button>
            <Button variant="secondary" asChild><Link to="/properties">العودة للعقارات</Link></Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <>
      <PageLayout dir="rtl" lang="ar" contentClassName="max-w-5xl">
        <PageHeader
          title="تعديل عقار"
          description="عدّل بيانات العقار الأساسية. تُدار الملكية واتفاقيات المالك من قسم علاقات الملاك لضمان سلامة الحسابات."
          secondaryActions={(
            <Button variant="secondary" onClick={() => requestNavigate('/properties')} disabled={isSubmitting}>
              العودة
            </Button>
          )}
        />
        <Card>
          <CardContent className="p-4 sm:p-5">
            <EntityForm.Root className="md:grid-cols-2" onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />
              <EntityForm.Field label="اسم العقار" error={form.formState.errors.title?.message}>
                <Input {...form.register('title')} placeholder="مثال: عمارة الندى" />
              </EntityForm.Field>
              <EntityForm.Field label="نوع العقار" error={form.formState.errors.type?.message}>
                <Input {...form.register('type')} placeholder="سكني، تجاري، أرض..." />
              </EntityForm.Field>
              <EntityForm.Field label="العنوان" className="md:col-span-2" error={form.formState.errors.address?.message}>
                <Input {...form.register('address')} placeholder="المدينة، الحي، الشارع" />
              </EntityForm.Field>
              <EntityForm.Field label="الحالة" error={form.formState.errors.status?.message}>
                <Select {...form.register('status')}>
                  {propertyStatusValues.map((status) => <option key={status} value={status}>{propertyStatusLabels[status]}</option>)}
                </Select>
              </EntityForm.Field>
              <EntityForm.Field label="قيمة الشراء" error={form.formState.errors.purchase_value?.message}>
                <Input type="number" step="0.01" inputMode="decimal" min="0" {...form.register('purchase_value')} />
              </EntityForm.Field>
              <EntityForm.Field label="القيمة الحالية" error={form.formState.errors.current_value?.message}>
                <Input type="number" step="0.01" inputMode="decimal" min="0" {...form.register('current_value')} />
              </EntityForm.Field>
              <EntityForm.Field label="ملاحظات" className="md:col-span-2">
                <Textarea {...form.register('notes')} placeholder="أي تفاصيل إضافية" />
              </EntityForm.Field>
              <EntityForm.Actions
                className="md:col-span-2"
                onCancel={() => requestNavigate('/properties')}
                isSubmitting={isSubmitting}
                submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ'}
              />
            </EntityForm.Root>
          </CardContent>
        </Card>
      </PageLayout>

      <DirtyRouteNavigationGuard
        isDirty={form.formState.isDirty}
        disabled={isSubmitting || showDiscardDialog}
        onDiscard={() => form.reset(undefined, { keepValues: true })}
      />

      <ConfirmDialog
        open={showDiscardDialog}
        onOpenChange={(nextOpen) => { if (!nextOpen) handleCancelDiscard(); }}
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
