import { useMemo, useState } from 'react';
import type { Owner } from './services/owner-service';
import {
  useOwnerActiveContracts,
  useOwners,
  usePropertiesWithOwners,
} from './useOwners';
import {
  buildOwnerWorkspaceRows,
  filterOwnerWorkspaceRows,
  summarizeOwners,
} from './utils/owner-ui-helpers';

export function getOwnerPageErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Owns the canonical owner register data, search state, summary and owner form.
 * Ownership relationships are intentionally handled inside the owner detail
 * experience rather than duplicated beside the directory list.
 */
export function useOwnersPageController() {
  const ownersQuery = useOwners();
  const propertiesQuery = usePropertiesWithOwners();
  const [ownerSearch, setOwnerSearch] = useState('');
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const owners = ownersQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const propertyIds = useMemo(() => properties.map((property) => property.id), [properties]);
  const activeContractsQuery = useOwnerActiveContracts(propertyIds);
  const activeContracts = activeContractsQuery.data ?? [];
  const summary = useMemo(() => summarizeOwners(owners, properties), [owners, properties]);
  const ownerWorkspaceRows = useMemo(
    () => buildOwnerWorkspaceRows(owners, properties, activeContracts),
    [activeContracts, owners, properties],
  );
  const filteredOwnerRows = useMemo(
    () => filterOwnerWorkspaceRows(ownerWorkspaceRows, ownerSearch),
    [ownerSearch, ownerWorkspaceRows],
  );

  const openCreateForm = () => { setEditingOwner(null); setFormOpen(true); };
  const openEditForm = (owner: Owner) => { setEditingOwner(owner); setFormOpen(true); };

  const firstLoadError = ownersQuery.error ?? propertiesQuery.error ?? activeContractsQuery.error;
  const hasLoadError = ownersQuery.isError || propertiesQuery.isError || activeContractsQuery.isError;
  const isLoading = ownersQuery.isLoading || propertiesQuery.isLoading || activeContractsQuery.isLoading;
  const retryOwnerWorkspace = async () => {
    await Promise.all([ownersQuery.refetch(), propertiesQuery.refetch(), activeContractsQuery.refetch()]);
  };

  return {
    ownerSearch,
    setOwnerSearch,
    editingOwner,
    formOpen,
    setFormOpen,
    summary,
    filteredOwnerRows,
    isLoading,
    hasLoadError,
    firstLoadError,
    retryOwnerWorkspace,
    openCreateForm,
    openEditForm,
  };
}
