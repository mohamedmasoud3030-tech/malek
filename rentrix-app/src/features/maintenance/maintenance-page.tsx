import { useMemo, useState } from 'react';
import { z } from 'zod';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Clock, Edit, Eye, Flame, PlusCircle, Wrench } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EntityForm } from '@/components/ui/entity-form';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { MobileCard } from '@/components/ui/mobile-card';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useProperties } from '@/features/properties/use-properties';
import { useAllUnits, useUnits } from '@/features/units/use-units';
import {
  useCreateMaintenance,
  useMaintenance,
  useResolveMaintenanceWithExpense,
  useUpdateMaintenance,
  useUpdateMaintenanceStatus,
} from './use-maintenance';
import type { Maintenance } from './maintenance-service';
import {
  buildMaintenanceLocationLabel,
  filterMaintenanceRequests,
  summarizeMaintenanceRequests,
  type MaintenancePriorityFilter,
  type MaintenanceStatusFilter,
} from './maintenance-helpers';

const schema = z.object({
  property_id: z.string().uuid('اختر العقار'),
  unit_id: z.string().nullable().optional().transform((value) => (value === '' ? null : value)),
  title: z.string().min(1, 'أدخل عنوان الطلب'),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigned_to: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  attachment_url: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

const resolveSchema = z.object({
  cost: z.coerce.number({ invalid_type_error: 'أدخل تكلفة صحيحة' }).min(0, 'التكلفة لا يمكن أن تكون سالبة'),
  notes: z.string().nullable().optional(),
});

type ResolveFormValues = z.infer<typeof resolveSchema>;

const maintenanceStatusLabels = {
  open: 'مفتوح',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  closed: 'مغلق',
} as const;

const maintenanceStatusTone = {
  open: 'blue',
  in_progress: 'gold',
  resolved: 'green',
  closed: 'gray',
} as const;

const maintenancePriorityLabels = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
} as const;

const maintenancePriorityTone = {
  low: 'gray',
  medium: 'blue',
  high: 'gold',
  urgent: 'red',
} as const;

function getLoadErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

void getLoadErrorMessage;

type MaintenanceAction = Readonly<{ label: string; status: Exclude<MaintenanceStatusFilter, 'all'> }>;

const summaryCards = [
  { key: 'total', label: 'إجمالي الطلبات', sub: 'ضمن الفلاتر الحالية', icon: Wrench, accent: 'primary' },
  { key: 'open', label: 'طلبات مفتوحة', sub: 'تحتاج إلى بدء المتابعة', icon: AlertCircle, accent: 'sky' },
  { key: 'inProgress', label: 'قيد التنفيذ', sub: 'طلبات يعمل عليها الفريق', icon: Clock, accent: 'amber' },
  { key: 'urgent', label: 'طلبات عاجلة', sub: 'أولوية فورية', icon: Flame, accent: 'rose' },
] as const;

function getMaintenanceStatusActions(status: keyof typeof maintenanceStatusLabels): MaintenanceAction[] {
  if (status === 'open') return [{ label: 'بدء التنفيذ', status: 'in_progress' }];
  if (status === 'in_progress') return [{ label: 'تم الحل', status: 'resolved' }];
  if (status === 'resolved') return [{ label: 'إغلاق', status: 'closed' }];
  return [];
}

export function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriorityFilter>('all');
  const [propertyFilterId, setPropertyFilterId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Maintenance | null>(null);
  const [detailsRequest, setDetailsRequest] = useState<Maintenance | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Maintenance | null>(null);

  const maintenanceQuery = useMaintenance(statusFilter, propertyFilterId);
  const propertiesQuery = useProperties({ search: '', status: 'all', page: 1, pageSize: 200 });
  const createMutation = useCreateMaintenance();
  const updateRequestMutation = useUpdateMaintenance();
  const updateStatusMutation = useUpdateMaintenanceStatus();
  const resolveMutation = useResolveMaintenanceWithExpense();
  const resolveForm = useForm<ResolveFormValues>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { cost: 0, notes: '' },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      property_id: '',
      unit_id: null,
      title: '',
      description: '',
      priority: 'medium',
      assigned_to: '',
      scheduled_date: '',
      attachment_url: null,
    },
  });

  const formPropertyId = form.watch('property_id');
  const unitsQuery = useUnits(formPropertyId);
  const allUnitsQuery = useAllUnits();

  const properties = propertiesQuery.data?.rows ?? [];
  const units = unitsQuery.data ?? [];
  const allUnits = allUnitsQuery.data ?? [];
  const maintenanceRows = maintenanceQuery.data ?? [];
  const filteredMaintenanceRows = useMemo(
    () => filterMaintenanceRequests(maintenanceRows, {
      status: statusFilter,
      priority: priorityFilter,
      propertyId: propertyFilterId,
    }),
    [maintenanceRows, priorityFilter, propertyFilterId, statusFilter],
  );
  const maintenanceSummary = useMemo(
    () => summarizeMaintenanceRequests(filteredMaintenanceRows),
    [filteredMaintenanceRows],
  );
  const loadError = maintenanceQuery.error ?? propertiesQuery.error;
  const hasLoadError = maintenanceQuery.isError || propertiesQuery.isError;
  const isLoading = maintenanceQuery.isLoading || propertiesQuery.isLoading;
  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all' || propertyFilterId.length > 0;
  const isEditingResolvedRequest = editingRequest?.status === 'resolved' || editingRequest?.status === 'closed';

  const firstCreateError = Object.values(form.formState.errors)
    .map((fieldError) => fieldError?.message)
    .find((message): message is string => typeof message === 'string' && message.length > 0);
  const firstResolveError = Object.values(resolveForm.formState.errors)
    .map((fieldError) => fieldError?.message)
    .find((message): message is string => typeof message === 'string' && message.length > 0);

  const retryMaintenanceWorkspace = async () => {
    await Promise.all([maintenanceQuery.refetch(), propertiesQuery.refetch()]);
  };

  const openCreateForm = () => {
    setEditingRequest(null);
    form.reset({ property_id: '', unit_id: null, title: '', description: '', priority: 'medium', assigned_to: '', scheduled_date: '', attachment_url: null });
    setShowForm(true);
  };

  const openEditForm = (row: Maintenance) => {
    setEditingRequest(row);
    form.reset({
      property_id: row.property_id ?? '',
      unit_id: row.unit_id ?? null,
      title: row.title ?? '',
      description: row.description ?? '',
      priority: (row.priority ?? 'medium') as FormValues['priority'],
      assigned_to: row.assigned_to ?? row.technician_name ?? '',
      scheduled_date: row.scheduled_date ?? '',
      attachment_url: row.attachment_url ?? null,
    });
    setShowForm(true);
  };

  const handleStatusAction = (row: Maintenance, status: Exclude<MaintenanceStatusFilter, 'all'>) => {
    if (status === 'resolved') {
      resolveForm.reset({ cost: 0, notes: '' });
      setResolveTarget(row);
      return;
    }
    updateStatusMutation.mutate({ requestId: row.id, status });
  };

  const submitResolve = (values: ResolveFormValues) => {
    if (!resolveTarget) return;
    resolveMutation.mutate(
      {
        requestId: resolveTarget.id,
        cost: values.cost,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      },
      { onSuccess: () => setResolveTarget(null) },
    );
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
        property_id: values.property_id,
        unit_id: values.unit_id,
        title: values.title,
        description: values.description ?? null,
        priority: values.priority,
        assigned_to: values.assigned_to?.trim() ? values.assigned_to.trim() : null,
        technician_name: values.assigned_to?.trim() ? values.assigned_to.trim() : null,
        scheduled_date: values.scheduled_date || null,
        attachment_url: values.attachment_url ?? null,
      };
    if (editingRequest) {
      updateRequestMutation.mutate({ requestId: editingRequest.id, payload }, { onSuccess: () => { setEditingRequest(null); setShowForm(false); } });
      return;
    }
    createMutation.mutate(payload, { onSuccess: () => { form.reset({ property_id: '', unit_id: null, title: '', description: '', priority: 'medium', assigned_to: '', scheduled_date: '', attachment_url: null }); setShowForm(false); } });
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="طلبات الصيانة"
        description="تتبع طلبات الصيانة حسب الحالة والأولوية والعقار، مع إجراءات واضحة للموبايل والديسكتوب."
        primaryAction={(
          <Button type="button" onClick={openCreateForm} className="min-h-11">
            <PlusCircle className="me-2 size-4" aria-hidden="true" />
            طلب صيانة جديد
          </Button>
        )}
      />

      <ResponsiveCardGrid desktopColumns={4}>
        {summaryCards.map((card) => (
          <KpiCard
            key={card.key}
            label={card.label}
            value={isLoading ? '—' : maintenanceSummary[card.key]}
            sub={card.sub}
            icon={card.icon}
            accent={card.accent}
          />
        ))}
      </ResponsiveCardGrid>

      <FilterBar
        filters={(
          <>
            <Select aria-label="تصفية حسب الحالة" value={String(statusFilter)} onChange={(event) => setStatusFilter(event.target.value as MaintenanceStatusFilter)}>
              <option value="all">كل الحالات</option>
              <option value="open">مفتوح</option>
              <option value="in_progress">قيد التنفيذ</option>
              <option value="resolved">تم الحل</option>
              <option value="closed">مغلق</option>
            </Select>
            <Select aria-label="تصفية حسب الأولوية" value={String(priorityFilter)} onChange={(event) => setPriorityFilter(event.target.value as MaintenancePriorityFilter)}>
              <option value="all">كل الأولويات</option>
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="urgent">عاجلة</option>
            </Select>
            <Select aria-label="تصفية حسب العقار" value={propertyFilterId} onChange={(event) => setPropertyFilterId(event.target.value)}>
              <option value="">كل العقارات</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
            </Select>
          </>
        )}
        actions={hasFilters ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setPropertyFilterId('');
            }}
          >
            مسح الفلاتر
          </Button>
        ) : undefined}
      />

      <AsyncContentState
        status={isLoading ? 'loading' : hasLoadError ? 'error' : filteredMaintenanceRows.length === 0 ? 'empty' : 'ready'}
        error={loadError}
        errorTitle="تعذر تحميل طلبات الصيانة"
        errorAction={<Button type="button" onClick={retryMaintenanceWorkspace}>إعادة المحاولة</Button>}
        emptyTitle="لا توجد طلبات صيانة"
        emptyDescription={hasFilters ? 'لا توجد طلبات تطابق الفلاتر الحالية.' : 'أضف طلب صيانة جديد للبدء.'}
      >
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:hidden">
            {filteredMaintenanceRows.map((row) => {
              const actions = getMaintenanceStatusActions((row.status ?? '') as keyof typeof maintenanceStatusLabels);
              return (
                <MobileCard
                  key={row.id}
                  title={row.title}
                  subtitle={buildMaintenanceLocationLabel(row, properties, allUnits)}
                  badge={(
                    <StatusBadge tone={maintenanceStatusTone[row.status as keyof typeof maintenanceStatusTone] ?? 'gray'}>
                      {maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status ?? '—'}
                    </StatusBadge>
                  )}
                  meta={(
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-muted-foreground">الأولوية</span>
                      <StatusBadge tone={maintenancePriorityTone[row.priority as keyof typeof maintenancePriorityTone] ?? 'gray'}>
                        {maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority ?? '—'}
                      </StatusBadge>
                    </div>
                  )}
                  actions={actions.length > 0 ? (
                    <div className="grid w-full grid-cols-1 gap-2">
                      <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" onClick={() => setDetailsRequest(row)}><Eye className="me-2 size-4" aria-hidden="true" />التفاصيل</Button>
                      <Button type="button" variant="secondary" className="min-h-11 px-3 text-xs" onClick={() => openEditForm(row)}><Edit className="me-2 size-4" aria-hidden="true" />تعديل</Button>
                      {actions.map((action) => (
                        <Button
                          key={`${row.id}-${action.status}`}
                          type="button"
                          variant="secondary"
                          className="min-h-11 px-3 text-xs"
                          disabled={updateStatusMutation.isPending || resolveMutation.isPending}
                          onClick={() => handleStatusAction(row, action.status)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <span className="flex min-h-11 items-center gap-1 text-xs font-bold text-muted-foreground">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />مكتمل
                    </span>
                  )}
                />
              );
            })}
          </div>

          <div className="hidden md:block">
            <DataTable
              aria-label="جدول طلبات الصيانة"
              rows={filteredMaintenanceRows}
              columns={[
                { key: 'title', header: 'العنوان', render: (row) => <span className="font-medium">{row.title}</span> },
                { key: 'location', header: 'الموقع', render: (row) => buildMaintenanceLocationLabel(row, properties, allUnits) },
                { key: 'status', header: 'الحالة', render: (row) => (
                  <StatusBadge tone={maintenanceStatusTone[row.status as keyof typeof maintenanceStatusTone] ?? 'gray'}>
                    {maintenanceStatusLabels[row.status as keyof typeof maintenanceStatusLabels] ?? row.status ?? '—'}
                  </StatusBadge>
                ) },
                { key: 'priority', header: 'الأولوية', render: (row) => (
                  <StatusBadge tone={maintenancePriorityTone[row.priority as keyof typeof maintenancePriorityTone] ?? 'gray'}>
                    {maintenancePriorityLabels[row.priority as keyof typeof maintenancePriorityLabels] ?? row.priority ?? '—'}
                  </StatusBadge>
                ) },
                { key: 'action', header: 'الإجراء', render: (row) => {
                  const actions = getMaintenanceStatusActions((row.status ?? '') as keyof typeof maintenanceStatusLabels);
                  return actions.length === 0 ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" />مكتمل</span>
                  ) : (
                    <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <ActionMenu
                        label="تحديث الطلب"
                        items={[{ id: 'details', label: 'التفاصيل', icon: Eye, onClick: () => setDetailsRequest(row) }, { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => openEditForm(row) }, ...actions.map((action) => ({
                          id: String(action.status),
                          label: action.label,
                          onClick: () => handleStatusAction(row, action.status),
                          disabled: updateStatusMutation.isPending || resolveMutation.isPending,
                        }))]}
                      />
                    </div>
                  );
                } },
              ]}
              keyOf={(row) => row.id}
              emptyTitle="لا توجد طلبات صيانة"
              emptyDescription="لا توجد طلبات تطابق الفلاتر الحالية."
            />
          </div>
        </>
      </AsyncContentState>

      <EntityForm.Overlay
        open={showForm}
        onOpenChange={(open) => { if (!createMutation.isPending && !updateRequestMutation.isPending) setShowForm(open); }}
        title={editingRequest ? 'تعديل طلب صيانة' : 'طلب صيانة جديد'}
        description="حدد الموقع والأولوية والمسؤول والموعد المجدول إن وجد."
      >
        <EntityForm.Root aria-busy={createMutation.isPending || updateRequestMutation.isPending} onSubmit={form.handleSubmit(onSubmit)}>
          <EntityForm.ErrorSummary message={firstCreateError} />

          <EntityForm.Section title="الموقع" description="اختر العقار، ويمكن ربط الطلب بوحدة محددة.">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-bold">
                <span>العقار</span>
                <Select aria-label="العقار" {...form.register('property_id')} disabled={isEditingResolvedRequest} aria-invalid={Boolean(form.formState.errors.property_id)}>
                  <option value="">اختر العقار</option>
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
                </Select>
                {form.formState.errors.property_id?.message ? <span className="text-xs text-destructive">{form.formState.errors.property_id.message}</span> : null}
              </label>

              <label className="space-y-1.5 text-sm font-bold">
                <span>الوحدة</span>
                <Select aria-label="الوحدة" {...form.register('unit_id')} disabled={isEditingResolvedRequest || !formPropertyId || unitsQuery.isLoading}>
                  <option value="">بدون وحدة</option>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_number}</option>)}
                </Select>
              </label>
            </div>
          </EntityForm.Section>
          {isEditingResolvedRequest ? <p className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-3 text-xs font-medium text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">لا يمكن تغيير موقع طلب تم حله أو إغلاقه حتى يبقى مرتبطاً بالمصروف المسجل.</p> : null}

          <EntityForm.Section title="تفاصيل الطلب" description="اكتب عنواناً قصيراً ثم أضف الوصف والأولوية.">
            <label className="space-y-1.5 text-sm font-bold">
              <span>عنوان الطلب</span>
              <Input aria-label="عنوان الطلب" placeholder="مثال: تسريب مياه في المطبخ" {...form.register('title')} aria-invalid={Boolean(form.formState.errors.title)} />
              {form.formState.errors.title?.message ? <span className="text-xs text-destructive">{form.formState.errors.title.message}</span> : null}
            </label>

            <label className="space-y-1.5 text-sm font-bold">
              <span>الوصف</span>
              <Textarea aria-label="وصف الطلب" placeholder="الوصف (اختياري)" className="min-h-24" {...form.register('description')} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-bold">
              <span>الأولوية</span>
              <Select aria-label="الأولوية" {...form.register('priority')}>
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
                <option value="urgent">عاجلة</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm font-bold"><span>المسؤول/الفني</span><Input placeholder="اسم الفني أو المسؤول" {...form.register('assigned_to')} /></label>
            <label className="space-y-1.5 text-sm font-bold sm:col-span-2"><span>تاريخ الجدولة</span><Input type="date" {...form.register('scheduled_date')} /></label>
            </div>

            <Controller
              control={form.control}
              name="attachment_url"
              render={({ field }) => (
                <FileAttachmentField label="صورة مرفقة (اختياري)" value={field.value ?? null} onChange={field.onChange} />
              )}
            />
          </EntityForm.Section>

          <EntityForm.Actions
            submitLabel={(createMutation.isPending || updateRequestMutation.isPending) ? 'جارٍ الحفظ...' : editingRequest ? 'حفظ التعديل' : 'حفظ الطلب'}
            onCancel={() => setShowForm(false)}
            isSubmitting={createMutation.isPending || updateRequestMutation.isPending}
            submitDisabled={properties.length === 0}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={detailsRequest != null}
        onOpenChange={(open) => { if (!open) setDetailsRequest(null); }}
        title="تفاصيل طلب الصيانة"
        description={detailsRequest?.title ?? undefined}
      >
        {detailsRequest ? (
          <div className="space-y-3 text-sm">
            <p className="rounded-2xl border p-3"><strong>الحالة:</strong> {maintenanceStatusLabels[detailsRequest.status as keyof typeof maintenanceStatusLabels] ?? detailsRequest.status}</p>
            <p className="rounded-2xl border p-3"><strong>الوصف:</strong> {detailsRequest.description || '—'}</p>
            <p className="rounded-2xl border p-3"><strong>الفني:</strong> {detailsRequest.assigned_to || detailsRequest.technician_name || '—'}</p>
            <p className="rounded-2xl border p-3"><strong>التكلفة:</strong> {detailsRequest.cost ?? 0}</p>
          </div>
        ) : null}
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={resolveTarget != null}
        onOpenChange={(open) => { if (!open && !resolveMutation.isPending) setResolveTarget(null); }}
        title="إغلاق طلب الصيانة"
        description="أدخل التكلفة الفعلية. سيتم تسجيلها كمصروف صيانة وفق منطق النظام الحالي."
      >
        <EntityForm.Root aria-busy={resolveMutation.isPending} onSubmit={resolveForm.handleSubmit(submitResolve)}>
          <EntityForm.ErrorSummary message={firstResolveError} />
          <EntityForm.Section title="التكلفة الفعلية" description={resolveTarget ? resolveTarget.title : undefined}>
            <label className="grid gap-2 text-sm font-bold">
              <span>التكلفة الفعلية (ر.ع)</span>
              <Input dir="ltr" type="number" min="0" step="0.01" inputMode="decimal" {...resolveForm.register('cost')} aria-invalid={Boolean(resolveForm.formState.errors.cost)} />
              {resolveForm.formState.errors.cost?.message ? <span className="text-xs text-destructive">{resolveForm.formState.errors.cost.message}</span> : null}
            </label>
            <label className="grid gap-2 text-sm font-bold">
              <span>ملاحظات (اختياري)</span>
              <Textarea className="min-h-20" {...resolveForm.register('notes')} />
            </label>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={resolveMutation.isPending ? 'جارٍ الحفظ...' : 'تأكيد الإغلاق'}
            onCancel={() => setResolveTarget(null)}
            isSubmitting={resolveMutation.isPending}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </PageLayout>
  );
}

export default MaintenancePage;
