import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RouteLoadingState } from '@/components/loading-state';
import { DirtyRouteNavigationGuard, useBeforeUnloadGuard, useSubmitGuard } from '@/hooks/use-unsaved-changes-guard';
import { propertySchema, propertyStatusLabels, propertyStatusValues, type PropertyFormValues } from './property-schema';
import { useCreateProperty, useProperty, useUpdateProperty } from './use-properties';

function fieldError(message?: string) {
  return message ? <p className="text-xs font-bold text-destructive">{message}</p> : null;
}

export function PropertyFormPage() {
  const params = useParams({ strict: false });
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;
  const isEdit = Boolean(propertyId);
  const router = useRouter();
  const propertyQuery = useProperty(propertyId ?? '');
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty(propertyId ?? '');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null);
  const { busy: isSubmittingGuard, run: runSubmit } = useSubmitGuard();
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: '',
      type: '',
      address: '',
      owner_name: '',
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
        owner_name: propertyQuery.data.owner_name ?? '',
        purchase_value: propertyQuery.data.purchase_value,
        current_value: propertyQuery.data.current_value,
        status: propertyQuery.data.status,
        notes: propertyQuery.data.notes ?? '',
      });
    }
  }, [form, propertyQuery.data]);

  const isMutationPending = createMutation.isPending || updateMutation.isPending;
  const isSubmitting = isSubmittingGuard || isMutationPending;

  const handleSubmit = form.handleSubmit(async (values) => {
    await runSubmit(async () => {
      setSubmitError(null);
      const payload = propertySchema.parse(values);
      try {
        if (isEdit && propertyId) {
          await updateMutation.mutateAsync(payload);
        } else {
          await createMutation.mutateAsync(payload);
        }
        // Clear dirty state before navigation so the beforeunload guard
        // does not trigger and the user can navigate freely.
        form.reset(undefined, { keepValues: true });
        await router.navigate({ to: '/properties' });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ العقار. تحقق من الصلاحيات ثم أعد المحاولة.');
      }
    });
  });

  const requestNavigate = (to: string) => {
    if (isSubmitting) {
      return;
    }

    if (form.formState.isDirty) {
      setPendingNavigateTo(to);
      setShowDiscardDialog(true);
      return;
    }
    router.navigate({ to });
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    form.reset(undefined, { keepValues: true });
    if (pendingNavigateTo) {
      router.navigate({ to: pendingNavigateTo });
      setPendingNavigateTo(null);
    }
  };

  const handleCancelDiscard = () => {
    setShowDiscardDialog(false);
    setPendingNavigateTo(null);
  };

  if (isEdit && propertyQuery.isLoading) return <RouteLoadingState />;
  if (isEdit && propertyQuery.isError) {
    return (
      <Card className="mx-auto max-w-3xl" role="alert" aria-live="assertive">
        <CardHeader>
          <CardTitle>تعذر تحميل العقار للتعديل</CardTitle>
          <CardDescription>{propertyQuery.error instanceof Error ? propertyQuery.error.message : 'تحقق من الصلاحيات أو الاتصال ثم أعد المحاولة.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => propertyQuery.refetch()}>إعادة المحاولة</Button>
          <Button variant="secondary" asChild><Link to="/properties">العودة للعقارات</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-5">
        <EntityDetailHeader
          title={isEdit ? 'تعديل عقار' : 'إضافة عقار جديد'}
          subtitle="أدخل بيانات العقار الأساسية. اسم المالك هنا للعرض الخفيف فقط وليس ربط ملكية أو حسابات ملاك."
          actions={
            <Button variant="secondary" onClick={() => requestNavigate('/properties')} disabled={isSubmitting}>
              العودة
            </Button>
          }
        />
        <Card>
          <CardContent>
            <form
              className="grid gap-5 md:grid-cols-2"
              onSubmit={handleSubmit}
              aria-busy={isSubmitting}
            >
              {submitError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold text-destructive md:col-span-2" role="alert">{submitError}</div>
              ) : null}
              <label className="grid gap-2 text-sm font-bold">
                اسم العقار
                <Input {...form.register('title')} placeholder="مثال: عمارة الندى" />
                {fieldError(form.formState.errors.title?.message)}
              </label>
              <label className="grid gap-2 text-sm font-bold">
                نوع العقار
                <Input {...form.register('type')} placeholder="سكني، تجاري، أرض..." />
                {fieldError(form.formState.errors.type?.message)}
              </label>
              <label className="grid gap-2 text-sm font-bold md:col-span-2">
                العنوان
                <Input {...form.register('address')} placeholder="المدينة، الحي، الشارع" />
                {fieldError(form.formState.errors.address?.message)}
              </label>
              <label className="grid gap-2 text-sm font-bold">
                اسم المالك للعرض
                <Input {...form.register('owner_name')} placeholder="اسم عرض اختياري يظهر في قائمة وتفاصيل العقار" />
                <p className="text-xs font-medium text-muted-foreground">حقل نصي خفيف للعرض فقط، ولا ينشئ حساب مالك أو نسب ملكية.</p>
              </label>
              <label className="grid gap-2 text-sm font-bold">
                الحالة
                <Select {...form.register('status')}>
                  {propertyStatusValues.map((status) => <option key={status} value={status}>{propertyStatusLabels[status]}</option>)}
                </Select>
                {fieldError(form.formState.errors.status?.message)}
              </label>
              <label className="grid gap-2 text-sm font-bold">
                قيمة الشراء
                <Input type="number" step="0.01" min="0" {...form.register('purchase_value')} />
                {fieldError(form.formState.errors.purchase_value?.message)}
              </label>
              <label className="grid gap-2 text-sm font-bold">
                القيمة الحالية
                <Input type="number" step="0.01" min="0" {...form.register('current_value')} />
                {fieldError(form.formState.errors.current_value?.message)}
              </label>
              <label className="grid gap-2 text-sm font-bold md:col-span-2">
                ملاحظات
                <Textarea {...form.register('notes')} placeholder="أي تفاصيل إضافية" />
              </label>
              <div className="flex justify-end gap-3 md:col-span-2">
                <Button variant="secondary" type="button" onClick={() => requestNavigate('/properties')} disabled={isSubmitting}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'جار الحفظ...' : 'حفظ'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <DirtyRouteNavigationGuard
        isDirty={form.formState.isDirty}
        disabled={isSubmitting || showDiscardDialog}
        onDiscard={() => form.reset(undefined, { keepValues: true })}
      />

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
