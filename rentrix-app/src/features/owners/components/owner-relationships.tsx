import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { OwnerCheckbox } from './owner-checkbox';
import { OwnerPropertySelect } from './owner-property-select';
import type { PropertyOwner, PropertyWithOwners } from '../services/owner-service';
import type { PropertyOwnershipLinkFormValues } from '../utils/owner-ui-helpers';

export type EditingPropertyOwnerLink = Readonly<{ id: string; propertyId: string; ownerId: string }>;
export type LinkedPropertyItem = Readonly<{ property: PropertyWithOwners; links: PropertyOwner[] }>;

type OwnerRelationshipsListProps = Readonly<{
  linkedProperties: LinkedPropertyItem[];
  endLinkPending: boolean;
  onEditLink: (link: PropertyOwner) => void;
  onEndLink: (link: PropertyOwner) => void;
}>;

/**
 * Read-only list of a selected owner's active property-ownership links,
 * with per-link edit/end actions. Ownership links are independent of any
 * office-management agreement or financial ledger.
 */
export function OwnerRelationshipsList({ linkedProperties, endLinkPending, onEditLink, onEndLink }: OwnerRelationshipsListProps) {
  if (!linkedProperties.length) return <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">لا توجد عقارات مرتبطة بهذا المالك بعد.</p>;
  return (
    <>
      {linkedProperties.map(({ property, links }) =>
        links.map((link) => (
          <div key={link.id} className="rounded-2xl border border-border bg-muted/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black">{property.title}</p><p className="text-xs text-muted-foreground">{property.address}</p></div>
              <StatusBadge tone={link.is_primary ? 'blue' : 'gray'}>{link.is_primary ? 'أساسي' : 'ثانوي'}</StatusBadge>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <span>نسبة الملكية: <b className="text-foreground">{link.ownership_percentage}%</b></span>
              <span>من: <b className="text-foreground">{link.starts_on ?? '—'}</b></span>
              <span>إلى: <b className="text-foreground">{link.ends_on ?? '—'}</b></span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-11 px-3" onClick={() => onEditLink(link)}>تعديل العلاقة</Button>
              <Button type="button" variant="danger" className="min-h-11 px-3" disabled={endLinkPending} onClick={() => onEndLink(link)}>إنهاء العلاقة</Button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

type OwnershipLinkFormProps = Readonly<{
  values: PropertyOwnershipLinkFormValues;
  availableProperties: PropertyWithOwners[];
  editingLink: EditingPropertyOwnerLink | null;
  error: string | null;
  isSaving: boolean;
  onCancelEdit: () => void;
  onSubmit: (event: FormEvent) => void;
  onValueChange: <K extends keyof PropertyOwnershipLinkFormValues>(field: K, value: PropertyOwnershipLinkFormValues[K]) => void;
}>;

/** Create/edit form for a single property-ownership link (percentage, dates, primary flag). */
export function OwnershipLinkForm({ values, availableProperties, editingLink, error, isSaving, onCancelEdit, onSubmit, onValueChange }: OwnershipLinkFormProps) {
  const isEditing = Boolean(editingLink);
  return (
    <EntityForm.Root onSubmit={onSubmit}>
      <EntityForm.ErrorSummary message={error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <OwnerPropertySelect value={values.property_id} onValueChange={(propertyId) => onValueChange('property_id', propertyId)} disabled={isEditing || !availableProperties.length} properties={availableProperties} />
        <Input type="number" min="0.01" inputMode="decimal" max="100" step="0.01" value={values.ownership_percentage} onChange={(e) => onValueChange('ownership_percentage', e.target.value)} aria-label="نسبة الملكية" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EntityForm.Field label="تاريخ البداية"><Input type="date" value={values.starts_on} onChange={(e) => onValueChange('starts_on', e.target.value)} /></EntityForm.Field>
        <EntityForm.Field label="تاريخ النهاية"><Input type="date" value={values.ends_on} onChange={(e) => onValueChange('ends_on', e.target.value)} /></EntityForm.Field>
      </div>
      <OwnerCheckbox checked={values.is_primary} label="مالك أساسي" onCheckedChange={(checked) => onValueChange('is_primary', checked)} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-sm font-bold" />
      <EntityForm.Actions
        onCancel={onCancelEdit}
        isSubmitting={isSaving}
        submitDisabled={!values.property_id}
        submitLabel={isEditing ? 'حفظ علاقة الملكية' : 'ربط المالك بالعقار'}
      />
    </EntityForm.Root>
  );
}
