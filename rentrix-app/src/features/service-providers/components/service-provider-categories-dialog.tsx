import { Edit, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { serviceProviderCategorySchema } from '../service-provider-schema';
import type { ServiceProviderCategory } from '../service-provider-service';
import {
  useArchiveServiceProviderCategory,
  useCreateServiceProviderCategory,
  useServiceProviderCategories,
  useUpdateServiceProviderCategory,
} from '../use-service-providers';

export function ServiceProviderCategoriesDialog({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
  const categoriesQuery = useServiceProviderCategories();
  const createMutation = useCreateServiceProviderCategory();
  const updateMutation = useUpdateServiceProviderCategory();
  const archiveMutation = useArchiveServiceProviderCategory();
  const [editing, setEditing] = useState<ServiceProviderCategory | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ServiceProviderCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setFormError(null);
  };

  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  const beginEdit = (category: ServiceProviderCategory) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? '');
    setFormError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = serviceProviderCategorySchema.safeParse({ name, description });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'راجع بيانات نوع الخدمة');
      return;
    }
    try {
      if (editing) await updateMutation.mutateAsync({ categoryId: editing.id, values: parsed.data });
      else await createMutation.mutateAsync(parsed.data);
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر حفظ نوع الخدمة');
    }
  };

  const categoryColumns: ColumnDef<ServiceProviderCategory>[] = useMemo(() => [
    { key: 'name', header: 'النوع', render: (category) => <span className="font-bold">{category.name}</span> },
    { key: 'description', header: 'الوصف', render: (category) => category.description ?? '—' },
    { key: 'actions', header: 'إجراءات', priority: 'actions', render: (category) => (
      <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <ActionMenu
          label={`إجراءات نوع الخدمة ${category.name}`}
          items={[
            { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => beginEdit(category) },
            { id: 'archive', label: 'أرشفة', icon: Trash2, danger: true, onClick: () => setArchiveTarget(category) },
          ]}
        />
      </div>
    ) },
  ], [beginEdit]);

  return (
    <>
      <EntityForm.Overlay
        open={open}
        onOpenChange={(next) => { if (!isSaving && !archiveMutation.isPending) onOpenChange(next); }}
        title="إدارة أنواع الخدمات"
        description="سجل قابل للصيانة تستخدمه ملفات المزودين وطلبات الصيانة بدل قائمة ثابتة داخل الواجهة."
        className="max-w-3xl"
      >
        <EntityForm.Root onSubmit={submit} aria-busy={isSaving}>
          <EntityForm.ErrorSummary message={formError} />
          <EntityForm.Section title={editing ? 'تعديل نوع الخدمة' : 'نوع خدمة جديد'}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <EntityForm.Field label="الاسم *">
                <Input required aria-label="اسم نوع الخدمة" value={name} onChange={(event) => { setName(event.target.value); setFormError(null); }} />
              </EntityForm.Field>
              <EntityForm.Field label="الوصف">
                <Textarea aria-label="وصف نوع الخدمة" value={description} onChange={(event) => { setDescription(event.target.value); setFormError(null); }} />
              </EntityForm.Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {editing ? <Button type="button" variant="secondary" onClick={resetForm}>إلغاء التعديل</Button> : null}
              <Button type="submit" disabled={isSaving}><Plus className="me-2 size-4" aria-hidden="true" />{editing ? 'حفظ النوع' : 'إضافة النوع'}</Button>
            </div>
          </EntityForm.Section>

          <EntityForm.Section title="الأنواع الحالية" description="أرشفة النوع تمنع استخدامه في تعيينات جديدة وتبقي العلاقات التاريخية محفوظة.">
            <AsyncContentState
              status={categoriesQuery.isLoading ? 'loading' : categoriesQuery.isError ? 'error' : (categoriesQuery.data ?? []).length === 0 ? 'empty' : 'ready'}
              error={categoriesQuery.error}
              errorTitle="تعذر تحميل أنواع الخدمات"
              errorAction={<Button type="button" onClick={() => void categoriesQuery.refetch()}>إعادة المحاولة</Button>}
              emptyTitle="لا توجد أنواع خدمات"
              emptyDescription="أضف أول نوع خدمة من النموذج أعلاه."
            >
              <EntityTable
                aria-label="أنواع خدمات المزودين"
                rows={categoriesQuery.data ?? []}
                columns={categoryColumns}
                keyOf={(category) => category.id}
                emptyTitle="لا توجد أنواع خدمات"
              />
            </AsyncContentState>
          </EntityForm.Section>
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(next) => { if (!next && !archiveMutation.isPending) setArchiveTarget(null); }}
        title="أرشفة نوع الخدمة؟"
        description={`لن يظهر "${archiveTarget?.name ?? ''}" في التعيينات الجديدة، وستبقى العلاقات السابقة محفوظة.`}
        confirmLabel="تأكيد الأرشفة"
        isLoading={archiveMutation.isPending}
        onConfirm={() => {
          if (!archiveTarget) return;
          archiveMutation.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) });
        }}
      />
    </>
  );
}
