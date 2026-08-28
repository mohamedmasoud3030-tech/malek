import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProperties } from '@/features/properties/use-properties';
import { ACTIVE_COMPANY_ERROR, useActiveCompanyId } from '@/hooks/use-company';
import { useAllUnits, useUnits } from '@/features/units/use-units';
import { useActiveServiceProviderOptions, useServiceProviderCategories } from '@/features/service-providers/use-service-providers';
import type { ServiceProviderOption } from '@/features/service-providers/service-provider-service';
import {
  useCreateMaintenance,
  useMaintenance,
  useResolveMaintenanceWithExpense,
  useUpdateMaintenance,
  useUpdateMaintenanceStatus,
} from './use-maintenance';
import type { Maintenance, MaintenanceChargeTarget } from './maintenance-service';
import {
  filterMaintenanceRequests,
  summarizeMaintenanceRequests,
  type MaintenancePriorityFilter,
  type MaintenanceStatusFilter,
} from './maintenance-helpers';
import {
  deriveMaintenanceAttention,
  matchesMaintenanceAttentionFilter,
  summarizeMaintenanceAttention,
  type MaintenanceAttention,
  type MaintenanceAttentionFilter,
} from './maintenance-attention';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';

export const maintenanceRequestSchema = z.object({
  // Historical production properties use text identifiers; the relationship
  // contract requires a selected property, not a UUID-shaped string.
  property_id: z.string().trim().min(1, 'اختر العقار'),
  unit_id: z.string().nullable().optional().transform((value) => (value === '' ? null : value)),
  service_provider_category_id: z.string().uuid('نوع الخدمة المحدد غير صالح').nullable().optional().transform((value) => (value === '' ? null : value)),
  service_provider_id: z.string().uuid('مزود الخدمة المحدد غير صالح').nullable().optional().transform((value) => (value === '' ? null : value)),
  title: z.string().min(1, 'أدخل عنوان الطلب'),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigned_to: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  attachment_url: z.string().nullable().optional(),
});

export type MaintenanceFormValues = z.infer<typeof maintenanceRequestSchema>;

export const maintenanceResolveSchema = z.object({
  cost: z.coerce.number({ invalid_type_error: 'أدخل تكلفة صحيحة' }).min(0, 'التكلفة لا يمكن أن تكون سالبة'),
  chargedTo: z.enum(['OWNER', 'TENANT', 'COMPANY'], { required_error: 'حدد من يتحمل التكلفة' }),
  notes: z.string().nullable().optional(),
});

export type MaintenanceResolveFormValues = z.infer<typeof maintenanceResolveSchema>;

export type MaintenanceAction = Readonly<{ label: string; status: Exclude<MaintenanceStatusFilter, 'all'> }>;

export function getCompatibleServiceProviderOptions(
  options: readonly ServiceProviderOption[],
  categoryId: string | null | undefined,
): ServiceProviderOption[] {
  if (!categoryId) return [...options];
  return options.filter((provider) => provider.categoryIds.includes(categoryId));
}

const emptyFormValues: MaintenanceFormValues = {
  property_id: '',
  unit_id: null,
  service_provider_category_id: null,
  service_provider_id: null,
  title: '',
  description: '',
  priority: 'medium',
  assigned_to: '',
  scheduled_date: '',
  attachment_url: null,
};

export function getMaintenanceStatusActions(status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'): MaintenanceAction[] {
  // R8 legal matrix. Cancelled ≠ Closed: cancellation is available while work
  // is not yet resolved and is terminal afterwards.
  if (status === 'open') return [{ label: 'بدء التنفيذ', status: 'in_progress' }, { label: 'إلغاء الطلب', status: 'cancelled' }];
  if (status === 'in_progress') return [{ label: 'تم الحل', status: 'resolved' }, { label: 'إلغاء الطلب', status: 'cancelled' }];
  if (status === 'resolved') return [{ label: 'إغلاق', status: 'closed' }];
  return [];
}

/**
 * Owns all MaintenancePage data fetching (maintenance requests, properties,
 * units), filter state, and the three overlay workflows (create/edit request,
 * details view, resolve-with-cost). MaintenancePage composes this hook with
 * MaintenanceList and the overlay components and stays render-only.
 */
export function useMaintenancePageController() {
  const activeCompanyId = useActiveCompanyId();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const requestedId = typeof search.requestId === 'string' ? search.requestId : '';
  const requestedQuickAdd = search.quickAdd === 'maintenance';
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriorityFilter>('all');
  const [propertyFilterId, setPropertyFilterId] = useState('');
  const [attentionFilter, setAttentionFilter] = useState<MaintenanceAttentionFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Maintenance | null>(null);
  const [detailsRequest, setDetailsRequest] = useState<Maintenance | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Maintenance | null>(null);

  const maintenanceQuery = useMaintenance(statusFilter, propertyFilterId);
  const propertiesQuery = useProperties({ search: '', status: 'all', page: 1, pageSize: 200 });
  const providerCategoriesQuery = useServiceProviderCategories();
  const providerOptionsQuery = useActiveServiceProviderOptions();
  const createMutation = useCreateMaintenance();
  const updateRequestMutation = useUpdateMaintenance();
  const updateStatusMutation = useUpdateMaintenanceStatus();
  const resolveMutation = useResolveMaintenanceWithExpense();
  const resolveForm = useForm<MaintenanceResolveFormValues>({
    resolver: zodResolver(maintenanceResolveSchema),
    defaultValues: { cost: 0, chargedTo: 'OWNER', notes: '' },
  });

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues: emptyFormValues,
  });

  const formPropertyId = form.watch('property_id');
  const selectedProviderCategoryId = form.watch('service_provider_category_id') ?? null;
  const selectedProviderId = form.watch('service_provider_id') ?? null;
  const unitsQuery = useUnits(formPropertyId);
  const allUnitsQuery = useAllUnits();

  const properties = propertiesQuery.data?.rows ?? [];
  const units = unitsQuery.data ?? [];
  const allUnits = allUnitsQuery.data ?? [];
  const providerCategories = providerCategoriesQuery.data ?? [];
  const providerOptions = providerOptionsQuery.data ?? [];
  const filteredProviderOptions = getCompatibleServiceProviderOptions(providerOptions, selectedProviderCategoryId);
  const maintenanceRows = maintenanceQuery.data ?? [];

  useEffect(() => {
    if (!requestedQuickAdd) return;
    setEditingRequest(null);
    form.reset(emptyFormValues);
    setShowForm(true);
    void navigate({
      to: '/maintenance',
      replace: true,
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next.quickAdd;
        return next;
      },
    });
  }, [form, navigate, requestedQuickAdd]);

  useEffect(() => {
    if (!requestedId) {
      setDetailsRequest(null);
      return;
    }
    const requested = maintenanceRows.find((row) => row.id === requestedId);
    if (requested) setDetailsRequest(requested);
  }, [maintenanceRows, requestedId]);

  useEffect(() => {
    if (!selectedProviderId || !selectedProviderCategoryId) return;
    const providerSupportsCategory = providerOptions.some(
      (provider) => provider.id === selectedProviderId && provider.categoryIds.includes(selectedProviderCategoryId),
    );
    if (!providerSupportsCategory) form.setValue('service_provider_id', null, { shouldDirty: true });
  }, [form, providerOptions, selectedProviderCategoryId, selectedProviderId]);

  const openDetailsRequest = (request: Maintenance) => {
    setDetailsRequest(request);
    void navigate({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, requestId: request.id }) });
  };

  const closeDetailsRequest = () => {
    setDetailsRequest(null);
    void navigate({
      to: '/maintenance',
      replace: true,
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next.requestId;
        return next;
      },
    });
  };

  const filteredMaintenanceRows = useMemo(
    () => filterMaintenanceRequests(maintenanceRows, {
      status: statusFilter,
      priority: priorityFilter,
      propertyId: propertyFilterId,
    }),
    [maintenanceRows, priorityFilter, propertyFilterId, statusFilter],
  );
  // Operational attention (stalled work, requests awaiting closure, missed
  // scheduled visits) is derived from the same rows the register already
  // loaded. It adds no lifecycle rule and performs no write.
  const operatingDate = getTodayLocalDateString();
  const attentionByRequestId = useMemo(
    () => new Map<string, MaintenanceAttention>(
      filteredMaintenanceRows.map((row) => [row.id, deriveMaintenanceAttention(row, operatingDate)]),
    ),
    [filteredMaintenanceRows, operatingDate],
  );
  const attentionSummary = useMemo(
    () => summarizeMaintenanceAttention(filteredMaintenanceRows, operatingDate),
    [filteredMaintenanceRows, operatingDate],
  );
  const visibleMaintenanceRows = useMemo(() => {
    if (attentionFilter === 'all') return filteredMaintenanceRows;
    return filteredMaintenanceRows.filter((row) => {
      const attention = attentionByRequestId.get(row.id);
      return attention ? matchesMaintenanceAttentionFilter(attention, attentionFilter) : false;
    });
  }, [attentionByRequestId, attentionFilter, filteredMaintenanceRows]);
  const maintenanceSummary = useMemo(
    () => summarizeMaintenanceRequests(filteredMaintenanceRows),
    [filteredMaintenanceRows],
  );
  const loadError = maintenanceQuery.error ?? propertiesQuery.error ?? providerCategoriesQuery.error ?? providerOptionsQuery.error;
  const hasLoadError = maintenanceQuery.isError || propertiesQuery.isError || providerCategoriesQuery.isError || providerOptionsQuery.isError;
  const isLoading = maintenanceQuery.isLoading || propertiesQuery.isLoading || providerCategoriesQuery.isLoading || providerOptionsQuery.isLoading;
  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all' || propertyFilterId.length > 0 || attentionFilter !== 'all';
  const isEditingResolvedRequest = editingRequest?.status === 'resolved' || editingRequest?.status === 'closed';

  const firstCreateError = Object.values(form.formState.errors)
    .map((fieldError) => fieldError?.message)
    .find((message): message is string => typeof message === 'string' && message.length > 0);
  const firstResolveError = Object.values(resolveForm.formState.errors)
    .map((fieldError) => fieldError?.message)
    .find((message): message is string => typeof message === 'string' && message.length > 0);

  const retryMaintenanceWorkspace = async () => {
    await Promise.all([
      maintenanceQuery.refetch(),
      propertiesQuery.refetch(),
      providerCategoriesQuery.refetch(),
      providerOptionsQuery.refetch(),
    ]);
  };

  const openCreateForm = () => {
    setEditingRequest(null);
    form.reset(emptyFormValues);
    setShowForm(true);
  };

  const openEditForm = (row: Maintenance) => {
    setEditingRequest(row);
    form.reset({
      property_id: row.property_id ?? '',
      unit_id: row.unit_id ?? null,
      service_provider_category_id: row.service_provider_category_id ?? null,
      service_provider_id: row.service_provider_id ?? null,
      title: row.title ?? '',
      description: row.description ?? '',
      priority: (row.priority ?? 'medium') as MaintenanceFormValues['priority'],
      assigned_to: row.assigned_to ?? row.technician_name ?? '',
      scheduled_date: row.scheduled_date ?? '',
      attachment_url: row.attachment_url ?? null,
    });
    setShowForm(true);
  };

  const handleStatusAction = (row: Maintenance, status: Exclude<MaintenanceStatusFilter, 'all'>) => {
    if (status === 'resolved') {
      const existingTarget = row.charged_to?.trim().toUpperCase();
      const chargedTo: MaintenanceChargeTarget = existingTarget === 'TENANT' || existingTarget === 'COMPANY' ? existingTarget : 'OWNER';
      resolveForm.reset({ cost: 0, chargedTo, notes: '' });
      setResolveTarget(row);
      return;
    }
    // R8: cancellation is a distinct terminal state and legally requires a
    // reason — collected here, enforced again server-side.
    if (status === 'cancelled') {
      const reason = window.prompt('سبب إلغاء طلب الصيانة (إلزامي):')?.trim();
      if (!reason) return;
      updateStatusMutation.mutate({ requestId: row.id, status, reason });
      return;
    }
    updateStatusMutation.mutate({ requestId: row.id, status });
  };

  const submitResolve = (values: MaintenanceResolveFormValues) => {
    if (!resolveTarget) return;
    resolveMutation.mutate(
      {
        requestId: resolveTarget.id,
        cost: values.cost,
        chargedTo: values.chargedTo,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      },
      { onSuccess: () => setResolveTarget(null) },
    );
  };

  const onSubmit = (values: MaintenanceFormValues) => {
    if (!activeCompanyId) {
      form.setError('root', { message: ACTIVE_COMPANY_ERROR });
      return;
    }

    const payload = {
      property_id: values.property_id,
      unit_id: values.unit_id,
      service_provider_category_id: values.service_provider_category_id ?? null,
      service_provider_id: values.service_provider_id ?? null,
      title: values.title,
      description: values.description ?? null,
      priority: values.priority,
      assigned_to: values.assigned_to?.trim() ? values.assigned_to.trim() : null,
      technician_name: values.assigned_to?.trim() ? values.assigned_to.trim() : null,
      scheduled_date: values.scheduled_date || null,
      attachment_url: values.attachment_url ?? null,
    };
    if (editingRequest) {
      // Update path keeps the legacy columns (cost, status, resolved_at) on the
      // existing row; the create path goes through the new atomic RPC.
      const updatePayload = {
        property_id: values.property_id,
        unit_id: values.unit_id,
        service_provider_category_id: values.service_provider_category_id ?? null,
        service_provider_id: values.service_provider_id ?? null,
        title: values.title,
        description: values.description ?? null,
        priority: values.priority,
        assigned_to: values.assigned_to?.trim() ? values.assigned_to.trim() : null,
        technician_name: values.assigned_to?.trim() ? values.assigned_to.trim() : null,
        scheduled_date: values.scheduled_date || null,
        attachment_url: values.attachment_url ?? null,
      };
      updateRequestMutation.mutate({ requestId: editingRequest.id, payload: updatePayload }, { onSuccess: () => { setEditingRequest(null); setShowForm(false); } });
      return;
    }
    createMutation.mutate(payload, { onSuccess: () => { form.reset(emptyFormValues); setShowForm(false); } });
  };

  return {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    propertyFilterId,
    setPropertyFilterId,
    showForm,
    setShowForm,
    editingRequest,
    detailsRequest,
    openDetailsRequest,
    closeDetailsRequest,
    resolveTarget,
    setResolveTarget,
    form,
    resolveForm,
    formPropertyId,
    properties,
    units,
    allUnits,
    providerCategories,
    providerOptions,
    filteredProviderOptions,
    selectedProviderCategoryId,
    filteredMaintenanceRows,
    visibleMaintenanceRows,
    attentionFilter,
    setAttentionFilter,
    attentionByRequestId,
    attentionSummary,
    maintenanceSummary,
    loadError,
    hasLoadError,
    isLoading,
    hasFilters,
    isEditingResolvedRequest,
    firstCreateError,
    firstResolveError,
    unitsQuery,
    createMutation,
    updateRequestMutation,
    updateStatusMutation,
    resolveMutation,
    retryMaintenanceWorkspace,
    openCreateForm,
    openEditForm,
    handleStatusAction,
    submitResolve,
    onSubmit,
  };
}