import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { PersonFormFields } from './components/PersonFormFields';
import { personSchema, type PersonFormValues } from './person-schema';
import { useCreatePerson, usePerson, useUpdatePerson } from './use-people';

export function PersonFormPage() {
  const params = useParams({ strict: false });
  const personId = typeof params.personId === 'string' ? params.personId : undefined;
  const isEdit = Boolean(personId);
  const router = useRouter();
  const personQuery = usePerson(personId ?? '');
  const createMutation = useCreatePerson();
  const updateMutation = useUpdatePerson(personId ?? '');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      email: '',
      national_id: '',
      type: 'tenant',
      address: '',
      notes: '',
    },
  });

  useEffect(() => {
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
  }, [form, personQuery.data]);

  if (isEdit && personQuery.isLoading) return <RouteLoadingState />;

  const retryPerson = async () => {
    await personQuery.refetch();
  };

  if (isEdit && personQuery.isError) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>تعذر تحميل بيانات الشخص</CardTitle>
          <CardDescription>{personQuery.error instanceof Error ? personQuery.error.message : 'حدث خطأ أثناء التحميل.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={retryPerson}>إعادة المحاولة</Button>
          <Button variant="secondary" asChild><Link to="/people">العودة</Link></Button>
        </CardContent>
      </Card>
    );
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const navigateBack = async () => {
    await router.navigate({ to: '/people' });
  };

  return (
    <Card className="mx-auto max-w-5xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{isEdit ? 'تعديل شخص' : 'إضافة شخص'}</CardTitle>
          <CardDescription>الجدول موحد للمستأجرين والملاك وجهات الاتصال.</CardDescription>
        </div>
        <Button variant="secondary" asChild><Link to="/people"><ArrowLeft className="me-2 size-4" />العودة</Link></Button>
      </CardHeader>
      <CardContent>
        <EntityForm.Root
          className="md:grid-cols-2"
          aria-busy={isSubmitting}
          onSubmit={form.handleSubmit(async (values) => {
            setSubmitError(null);
            const payload = personSchema.parse(values);
            try {
              if (isEdit && personId) {
                await updateMutation.mutateAsync(payload);
              } else {
                await createMutation.mutateAsync(payload);
              }
              await router.navigate({ to: '/people' });
            } catch (error) {
              setSubmitError(error instanceof Error ? error.message : 'تعذر حفظ بيانات الشخص. تحقق من الصلاحيات وحاول مرة أخرى.');
            }
          })}
        >
          <EntityForm.ErrorSummary className="md:col-span-2" message={submitError} />
          <PersonFormFields form={form} />
          <EntityForm.Actions
            className="md:col-span-2"
            onCancel={navigateBack}
            isSubmitting={isSubmitting}
            submitLabel={isSubmitting ? 'جار الحفظ...' : 'حفظ'}
          />
        </EntityForm.Root>
      </CardContent>
    </Card>
  );
}
