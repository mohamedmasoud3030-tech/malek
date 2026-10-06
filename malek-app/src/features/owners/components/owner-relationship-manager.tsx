import { useMemo, useState, type FormEvent } from 'react';
import { LinkIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import {
  useLinkOwnerToProperty,
  usePropertiesWithOwners,
  useUnlinkOwnerFromProperty,
  useUpdatePropertyOwnerLink,
} from '../useOwners';
import type { PropertyOwner } from '../services/owner-service';
import {
  emptyPropertyOwnershipLinkFormValues,
  isActivePropertyOwnerLink,
  propertyOwnerLinkToFormValues,
  propertyOwnershipLinkFormToPayload,
  validatePropertyOwnershipLinkForm,
  type PropertyOwnershipLinkFormValues,
} from '../utils/owner-ui-helpers';
import {
  OwnerRelationshipsList,
  OwnershipLinkForm,
  type EditingPropertyOwnerLink,
  type LinkedPropertyItem,
} from './owner-relationships';

export function OwnerRelationshipManager({
  ownerId,
  canManage,
}: Readonly<{
  ownerId: string;
  canManage: boolean;
}>) {
  const propertiesQuery = usePropertiesWithOwners();
  const linkMutation = useLinkOwnerToProperty();
  const updateMutation = useUpdatePropertyOwnerLink();
  const unlinkMutation = useUnlinkOwnerFromProperty();
  const [managerOpen, setManagerOpen] = useState(false);
  const [formMode, setFormMode] = useState(false);
  const [editingLink, setEditingLink] = useState<EditingPropertyOwnerLink | null>(null);
  const [values, setValues] = useState<PropertyOwnershipLinkFormValues>(emptyPropertyOwnershipLinkFormValues);
  const [formError, setFormError] = useState<string | null>(null);

  const properties = propertiesQuery.data ?? [];
  const linkedProperties = useMemo<LinkedPropertyItem[]>(() => properties
    .map((property) => ({
      property,
      links: property.property_owners.filter((link) => link.owner_id === ownerId && isActivePropertyOwnerLink(link)),
    }))
    .filter((item) => item.links.length > 0), [ownerId, properties]);

  const availableProperties = useMemo(() => {
    if (editingLink) return properties.filter((property) => property.id === editingLink.propertyId);
    return properties.filter((property) => !property.property_owners.some(
      (link) => link.owner_id === ownerId && isActivePropertyOwnerLink(link),
    ));
  }, [editingLink, ownerId, properties]);

  if (!canManage) return null;

  const resetFormState = () => {
    setEditingLink(null);
    setValues(emptyPropertyOwnershipLinkFormValues);
    setFormError(null);
    setFormMode(false);
  };

  const closeManager = () => {
    resetFormState();
    setManagerOpen(false);
  };

  const openCreate = () => {
    setEditingLink(null);
    setValues(emptyPropertyOwnershipLinkFormValues);
    setFormError(null);
    setFormMode(true);
  };

  const openEdit = (link: PropertyOwner) => {
    setEditingLink({ id: link.id, propertyId: link.property_id, ownerId: link.owner_id });
    setValues(propertyOwnerLinkToFormValues(link));
    setFormError(null);
    setFormMode(true);
  };

  const setField = <K extends keyof PropertyOwnershipLinkFormValues>(field: K, value: PropertyOwnershipLinkFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validatePropertyOwnershipLinkForm(values);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    try {
      if (editingLink) {
        await updateMutation.mutateAsync({
          linkId: editingLink.id,
          payload: propertyOwnershipLinkFormToPayload(values),
        });
      } else {
        await linkMutation.mutateAsync({
          owner_id: ownerId,
          property_id: values.property_id,
          ...propertyOwnershipLinkFormToPayload(values),
        });
      }
      resetFormState();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر حفظ علاقة الملكية.');
    }
  };

  const handleEnd = async (link: PropertyOwner) => {
    try {
      await unlinkMutation.mutateAsync({ linkId: link.id, propertyId: link.property_id, ownerId: link.owner_id });
      if (editingLink?.id === link.id) resetFormState();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر إنهاء علاقة الملكية.');
    }
  };

  return (
    <div data-owner-relationship-manager className="flex justify-end">
      <Button type="button" variant="secondary" className="min-h-11" onClick={() => setManagerOpen(true)}>
        <LinkIcon className="me-2 size-4" />
        إدارة علاقات الملكية
      </Button>

      <EntityForm.Overlay
        open={managerOpen}
        onOpenChange={(open) => { if (!open) closeManager(); else setManagerOpen(true); }}
        title={formMode ? (editingLink ? 'تعديل علاقة الملكية' : 'ربط عقار بالمالك') : 'إدارة علاقات الملكية'}
        description={formMode
          ? 'تعديل أو إنشاء علاقة الملكية داخل ملف المالك دون إنشاء حركة مالية.'
          : 'العقارات ونسب الملكية لهذا المالك. العرض الأساسي يظل في قسم العقارات والعقود.'}
      >
        {formMode ? (
          <OwnershipLinkForm
            values={values}
            availableProperties={availableProperties}
            editingLink={editingLink}
            error={formError}
            isSaving={linkMutation.isPending || updateMutation.isPending}
            onCancelEdit={resetFormState}
            onSubmit={handleSubmit}
            onValueChange={setField}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" className="min-h-11" onClick={openCreate} disabled={availableProperties.length === 0}>
                <Plus className="me-2 size-4" />
                ربط عقار
              </Button>
            </div>
            {formError ? <p className="text-sm font-semibold text-danger">{formError}</p> : null}
            {propertiesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">جارٍ تحميل علاقات الملكية…</p>
            ) : propertiesQuery.isError ? (
              <div className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
                تعذر تحميل علاقات الملكية.
                <Button type="button" variant="ghost" className="ms-2 min-h-11" onClick={() => propertiesQuery.refetch()}>إعادة المحاولة</Button>
              </div>
            ) : (
              <OwnerRelationshipsList
                linkedProperties={linkedProperties}
                endLinkPending={unlinkMutation.isPending}
                onEditLink={openEdit}
                onEndLink={handleEnd}
              />
            )}
          </div>
        )}
      </EntityForm.Overlay>
    </div>
  );
}
