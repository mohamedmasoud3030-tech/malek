import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  filterMaintenanceRequests,
  summarizeMaintenanceRequests,
  type MaintenancePriorityFilter,
  type MaintenanceStatusFilter,
} from './maintenance-helpers';

export const maintenanceRequestSchema = z.object({
  property_id: z.string().uuid('اختر العقار'),
  unit_id: z.string().nullable().optional().transform((value) => (value === '' ? null : value)),
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
  notes: z.string().nullable().optional(),
});

export type MaintenanceResolveFormValues = z.infer<typeof maintenanceResolveSchema>;

export type MaintenanceAction = Readonly<{ label: string; status: Exclude<MaintenanceStatusFilter, 'all'> }>;

const emptyFormValues: MaintenanceFormValues = {
  property_id: '',
  unit_id: null,
  title: '',
  description: '',
  priority: 'medium',
  assigned_to: '',
  scheduled_date: '',
  attachment_url: null,
};

export function getMaintenanceStatusActions(status: 'open' | 'in_progress' | 'resolved' | 'closed'): MaintenanceAction[] {
  if (status === 'open') return [{ label: 'بدء التنفيذ', status: 'in_progress' }];
  if (status === 'in_progress') return [{ label: 'تم الحل', status: 'resolved' }];
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
  const resolveForm = useForm<MaintenanceResolveFormValues>({
    resolver: zodResolver(maintenanceResolveSchema),
    defaultValues: { cost: 0, notes: '' },
  });

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues: emptyFormValues,
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
    form.reset(emptyFormValues);
    setShowForm(true);
  };

  const openEditForm = (row: Maintenance) => {
    setEditingRequest(row);
    form.reset({
      property_id: row.property_id ?? '',
      unit_id: row.unit_id ?? null,
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
      resolveForm.reset({ cost: 0, notes: '' });
      setResolveTarget(row);
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
        notes: values.notes?.trim() ? values.notes.trim() : null,
      },
      { onSuccess: () => setResolveTarget(null) },
    );
  };

  const onSubmit = (values: MaintenanceFormValues) => {
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
    createMutation.mutate({ ...payload, status: 'open', cost: 0, resolved_at: null }, { onSuccess: () => { form.reset(emptyFormValues); setShowForm(false); } });
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
    setDetailsRequest,
    resolveTarget,
    setResolveTarget,
    form,
    resolveForm,
    formPropertyId,
    properties,
    units,
    allUnits,
    filteredMaintenanceRows,
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
