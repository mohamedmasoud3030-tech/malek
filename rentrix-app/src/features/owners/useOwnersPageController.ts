import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Owner, PropertyOwner, PropertyWithOwners } from './services/owner-service';
import {
  useLinkOwnerToProperty,
  useOwnerActiveContracts,
  useOwners,
  usePropertiesWithOwners,
  useUnlinkOwnerFromProperty,
  useUpdatePropertyOwnerLink,
} from './useOwners';
import {
  buildOwnerWorkspaceRows,
  emptyPropertyOwnershipLinkFormValues,
  filterOwnerWorkspaceRows,
  isActivePropertyOwnerLink,
  propertyOwnerLinkToFormValues,
  propertyOwnershipLinkFormToPayload,
  summarizeOwners,
  validatePropertyOwnershipLinkForm,
  type PropertyOwnershipLinkFormValues,
} from './utils/owner-ui-helpers';
import type { EditingPropertyOwnerLink, LinkedPropertyItem } from './components/owner-relationships';

export function getOwnerPageErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getLinkedPropertiesForOwner(owner: Owner | null, properties: PropertyWithOwners[]): LinkedPropertyItem[] {
  if (!owner) return [];
  return properties
    .map((property) => ({ property, links: property.property_owners.filter((link) => link.owner_id === owner.id && isActivePropertyOwnerLink(link)) }))
    .filter((item) => item.links.length > 0);
}

function getAvailablePropertiesForLink(owner: Owner | null, properties: PropertyWithOwners[], editingLink: EditingPropertyOwnerLink | null): PropertyWithOwners[] {
  if (!owner) return [];
  if (editingLink) return properties.filter((p) => p.id === editingLink.propertyId);
  return properties.filter((p) => !p.property_owners.some((link) => link.owner_id === owner.id && isActivePropertyOwnerLink(link)));
}

/**
 * Owns all OwnersPage data fetching, owner-directory selection/search state,
 * and the ownership-link (link/edit/unlink) workflow. OwnersPage composes
 * this hook with OwnerWorkspaceTable, OwnerRelationshipsList/Form, and
 * OwnerFormDialog and stays render-only.
 */
export function useOwnersPageController() {
  const ownersQuery = useOwners();
  const propertiesQuery = usePropertiesWithOwners();
  const linkMutation = useLinkOwnerToProperty();
  const updateLinkMutation = useUpdatePropertyOwnerLink();
  const unlinkMutation = useUnlinkOwnerFromProperty();
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [linkFormValues, setLinkFormValues] = useState<PropertyOwnershipLinkFormValues>(emptyPropertyOwnershipLinkFormValues);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<EditingPropertyOwnerLink | null>(null);
  const [linkFormOpen, setLinkFormOpen] = useState(false);

  const owners = ownersQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const activeContractsQuery = useOwnerActiveContracts(propertyIds);
  const activeContracts = activeContractsQuery.data ?? [];
  const isSavingLink = linkMutation.isPending || updateLinkMutation.isPending;
  const selectedOwner = owners.find((o) => o.id === selectedOwnerId) ?? owners[0] ?? null;
  const summary = useMemo(() => summarizeOwners(owners, properties), [owners, properties]);
  const ownerWorkspaceRows = useMemo(() => buildOwnerWorkspaceRows(owners, properties, activeContracts), [activeContracts, owners, properties]);
  const filteredOwnerRows = useMemo(() => filterOwnerWorkspaceRows(ownerWorkspaceRows, ownerSearch), [ownerSearch, ownerWorkspaceRows]);
  const linkedProperties = useMemo(() => getLinkedPropertiesForOwner(selectedOwner, properties), [properties, selectedOwner]);
  const availableProperties = useMemo(() => getAvailablePropertiesForLink(selectedOwner, properties, editingLink), [editingLink, properties, selectedOwner]);

  useEffect(() => {
    if (!selectedOwnerId && owners[0]) setSelectedOwnerId(owners[0].id);
  }, [owners, selectedOwnerId]);

  const openCreateForm = () => { setEditingOwner(null); setFormOpen(true); };
  const openEditForm = (owner: Owner) => { setEditingOwner(owner); setFormOpen(true); };
  const setLinkField = <K extends keyof PropertyOwnershipLinkFormValues>(field: K, value: PropertyOwnershipLinkFormValues[K]) => {
    setLinkFormValues((cur) => ({ ...cur, [field]: value })); setLinkFormError(null);
  };
  const beginEditLink = (link: PropertyOwner) => {
    setEditingLink({ id: link.id, propertyId: link.property_id, ownerId: link.owner_id });
    setLinkFormValues(propertyOwnerLinkToFormValues(link));
    setLinkFormError(null);
    setLinkFormOpen(true);
  };
  const resetLinkForm = () => { setEditingLink(null); setLinkFormValues(emptyPropertyOwnershipLinkFormValues); setLinkFormError(null); setLinkFormOpen(false); };
  const openLinkForm = () => {
    setEditingLink(null);
    setLinkFormValues(emptyPropertyOwnershipLinkFormValues);
    setLinkFormError(null);
    setLinkFormOpen(true);
  };
  const handleEndPropertyOwnership = async (link: PropertyOwner) => {
    try {
      await unlinkMutation.mutateAsync({ linkId: link.id, propertyId: link.property_id, ownerId: link.owner_id });
      if (editingLink?.id === link.id) resetLinkForm();
    } catch (error) {
      setLinkFormError(error instanceof Error ? error.message : 'تعذر إنهاء علاقة الملكية. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };
  const handleLinkProperty = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOwner) return;
    const validationError = validatePropertyOwnershipLinkForm(linkFormValues);
    if (validationError) { setLinkFormError(validationError); return; }
    try {
      if (editingLink) await updateLinkMutation.mutateAsync({ linkId: editingLink.id, payload: propertyOwnershipLinkFormToPayload(linkFormValues) });
      else await linkMutation.mutateAsync({ owner_id: selectedOwner.id, property_id: linkFormValues.property_id, ...propertyOwnershipLinkFormToPayload(linkFormValues) });
      resetLinkForm();
    } catch (error) {
      setLinkFormError(error instanceof Error ? error.message : 'تعذر حفظ علاقة الملكية. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };

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
    linkFormValues,
    linkFormError,
    editingLink,
    linkFormOpen,
    setLinkFormOpen,
    selectedOwner,
    summary,
    filteredOwnerRows,
    linkedProperties,
    availableProperties,
    isSavingLink,
    unlinkPending: unlinkMutation.isPending,
    isLoading,
    hasLoadError,
    firstLoadError,
    retryOwnerWorkspace,
    openCreateForm,
    openEditForm,
    setLinkField,
    beginEditLink,
    resetLinkForm,
    openLinkForm,
    handleEndPropertyOwnership,
    handleLinkProperty,
    setSelectedOwnerId,
  };
}
