import { useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
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
  const [formOpen, setFormOpen] = useState(false);
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

  const resetForm = () => {
    setEditingLink(null);
    setValues(emptyPropertyOwnershipLinkFormValues);
    setFormError(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditingLink(null);
    setValues(emptyPropertyOwnershipLinkFormValues);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (link: PropertyOwner) => {
    setEditingLink({ id: link.id, propertyId: link.property_id, ownerId: link.owner_id });
    setValues(propertyOwnerLinkToFormValues(link));
    setFormError(null);
    setFormOpen(true);
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
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر حفظ علاقة الملكية.');
    }
  };

  const handleEnd = async (link: PropertyOwner) => {
    try {
      await unlinkMutation.mutateAsync({ linkId: link.id, propertyId: link.property_id, ownerId: link.owner_id });
      if (editingLink?.id === link.id) resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر إنهاء علاقة الملكية.');
    }
  };

  return (
    <section data-owner-relationship-manager className="space-y-3" aria-label="علاقات الملكية">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-foreground">علاقات الملكية</h3>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            العقارات ونسب الملكية الخاصة بهذا المالك تُدار من ملفه فقط.
          </p>
        </div>
        {canManage ? (
          <Button type="button" variant="secondary" className="min-h-11" onClick={openCreate} disabled={availableProperties.length === 0}>
            <Plus className="me-2 size-4" />
            ربط عقار
          </Button>
        ) : null}
      </div>

      {propertiesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ تحميل علاقات الملكية…</p>
      ) : propertiesQuery.isError ? (
        <div className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
          تعذر تحميل علاقات الملكية.
          <Button type="button" variant="ghost" className="ms-2 min-h-11" onClick={() => propertiesQuery.refetch()}>إعادة المحاولة</Button>
        </div>
      ) : linkedProperties.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">لا توجد عقارات مرتبطة بهذا المالك بعد.</p>
      ) : canManage ? (
        <OwnerRelationshipsList
          linkedProperties={linkedProperties}
          endLinkPending={unlinkMutation.isPending}
          onEditLink={openEdit}
          onEndLink={handleEnd}
        />
      ) : (
        <div className="space-y-2">
          {linkedProperties.flatMap(({ property, links }) => links.map((link) => (
            <div key={link.id} className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
              <p className="font-bold">{property.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">نسبة الملكية: {link.ownership_percentage}%{link.is_primary ? ' · مالك أساسي' : ''}</p>
            </div>
          )))}
        </div>
      )}

      {canManage ? (
        <EntityForm.Overlay
          open={formOpen}
          onOpenChange={(open) => { if (!open) resetForm(); else setFormOpen(true); }}
          title={editingLink ? 'تعديل علاقة الملكية' : 'ربط عقار بالمالك'}
          description="تدار علاقة الملكية داخل ملف المالك؛ ولا تُنشئ حركة مالية بحد ذاتها."
        >
          <OwnershipLinkForm
            values={values}
            availableProperties={availableProperties}
            editingLink={editingLink}
            error={formError}
            isSaving={linkMutation.isPending || updateMutation.isPending}
            onCancelEdit={resetForm}
            onSubmit={handleSubmit}
            onValueChange={setField}
          />
        </EntityForm.Overlay>
      ) : null}
    </section>
  );
}
