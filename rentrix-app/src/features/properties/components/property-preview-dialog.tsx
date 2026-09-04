import { FolderOpen } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatPropertyUnitSummary } from '@/features/properties/property-card-utils';
import { propertyStatusLabels } from '@/features/properties/property-schema';
import { propertyStatusTone, translatePropertyType } from './property-status';
import type { PropertyListItem } from '../property-service';

/**
 * Property Quick Preview — glance-first.
 * Answers: what is this property, where is it, who owns it, how is it
 * operational. Owners, units, contracts, financial context and documents
 * belong to «فتح ملف العقار».
 */
export function PropertyPreviewDialog({
  property,
  open,
  onOpenChange,
  onEdit,
  onArchive,
}: Readonly<{
  property: PropertyListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (propertyId: string) => void;
  onArchive?: (propertyId: string, title: string) => void;
}>) {
  const navigate = useNavigate();
  const units = property?.units ?? [];
  const unitSummary = formatPropertyUnitSummary(
    units.length,
    units.filter((unit) => unit.status === 'occupied').length,
  );
  const workflowLabel = property
    ? property.workflow_health === 'ready'
      ? 'جاهز للتشغيل'
      : property.workflow_health === 'missing_owner'
        ? 'يحتاج مالكاً'
        : property.workflow_health === 'owner_unavailable'
          ? 'المالك غير نشط'
          : 'يحتاج اتفاقية'
    : '';

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={property?.title ?? 'معاينة العقار'}
      status={property ? (
        <StatusBadge tone={propertyStatusTone[property.status as keyof typeof propertyStatusTone] ?? 'neutral'}>
          {propertyStatusLabels[property.status as keyof typeof propertyStatusLabels] ?? property.status}
        </StatusBadge>
      ) : undefined}
      footer={property ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({ to: '/properties/$propertyId', params: { propertyId: property.id } })}
          >
            <FolderOpen className="me-2 size-4" aria-hidden="true" />
            فتح ملف العقار
          </Button>
          {onEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => onEdit(property.id)}>
              تعديل البيانات
            </Button>
          ) : null}
          {onArchive ? (
            <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={() => onArchive(property.id, property.title ?? 'عقار')}>
              أرشفة
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {property ? (
        <PreviewFacts
          rows={[
            { label: 'النوع', value: translatePropertyType(property.type) },
            { label: 'العنوان', value: property.address ?? '—', wide: true },
            { label: 'المالك', value: property.current_owner_name ?? property.owner_name ?? 'غير مرتبط بمالك' },
            { label: 'الوحدات', value: unitSummary.text },
            { label: 'جاهزية التشغيل', value: workflowLabel },
          ]}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}
