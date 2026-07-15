import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { propertyStatusLabels, propertyStatusValues } from './property-schema';
import { useProperties, useSoftDeleteProperty } from './use-properties';
import type { PropertyStatusFilter } from './property-service';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';

const PAGE_SIZE = 10;

/**
 * Controller hook for the Properties list page.
 * Encapsulates search/filter/pagination state, query orchestration,
 * modal/dialog state, and archive action — keeping the page component
 * as a pure orchestrator of UI primitives.
 */
export function usePropertyListController() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PropertyStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPropertyId, setEditPropertyId] = useState<string | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);

  const params = useMemo(() => ({ search, status, page, pageSize: PAGE_SIZE }), [page, search, status]);
  const propertiesQuery = useProperties(params);
  const deleteMutation = useSoftDeleteProperty();
  const navigate = useNavigate();

  const properties = propertiesQuery.data?.rows ?? [];
  const totalCount = propertiesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilterValues = search.trim().length > 0 || status !== 'all';

  const activeFilters: ActiveFilterItem[] = useMemo(() => [
    ...(search.trim()
      ? [{ key: 'search', label: 'بحث', value: search.trim(), onRemove: () => { setSearch(''); setPage(1); } }]
      : []),
    ...(status !== 'all'
      ? [{ key: 'status', label: 'الحالة', value: propertyStatusLabels[status as Exclude<PropertyStatusFilter, 'all'>], onRemove: () => { setStatus('all'); setPage(1); } }]
      : []),
  ], [search, status]);

  const clearFilters = () => { setSearch(''); setStatus('all'); setPage(1); };

  const openCreateModal = () => { setEditPropertyId(undefined); setModalOpen(true); };
  const openEditModal = (id: string) => { setEditPropertyId(id); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditPropertyId(undefined); };
  const requestArchive = (id: string, title: string) => setArchiveTarget({ id, title });
  const cancelArchive = () => setArchiveTarget(null);

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    await deleteMutation.mutateAsync(archiveTarget.id);
    setArchiveTarget(null);
  };

  const navigateToProperty = (propertyId: string) => {
    navigate({ to: '/properties/$propertyId', params: { propertyId } });
  };

  return {
    // Data
    properties,
    totalCount,
    totalPages,
    propertiesQuery,
    deleteMutation,

    // Search & filter state
    search,
    setSearch,
    status,
    setStatus,
    page,
    setPage,
    hasFilterValues,
    activeFilters,
    clearFilters,
    statusValues: propertyStatusValues,
    statusLabels: propertyStatusLabels,

    // Modal state
    modalOpen,
    editPropertyId,
    openCreateModal,
    openEditModal,
    closeModal,

    // Archive state
    archiveTarget,
    requestArchive,
    cancelArchive,
    confirmArchive,
    isArchiving: deleteMutation.isPending,

    // Navigation
    navigateToProperty,
  };
}
