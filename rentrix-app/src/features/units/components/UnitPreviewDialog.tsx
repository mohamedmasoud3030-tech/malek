import { FolderOpen, Pencil } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { normalizeUnitStatus, unitStatusLabels, unitStatusTones } from '../unit-schema';
import type { Unit } from '@/types/domain';

/**
 * Unit Quick Preview — glance-first.
 * Identity, property, rent reference and lifecycle status. The full unit
 * dossier (contracts, occupancy, documents, activity) is the unit detail page.
 */
export function UnitPreviewDialog({
  unit,
  propertyTitle,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  unit: Unit | null;
  propertyTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (unit: Unit) => void;
}>) {
  const navigate = useNavigate();
  const companyFormatters = useCompanyFormatters();
  const status = unit ? normalizeUnitStatus(String(unit.status)) : null;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={unit ? `وحدة ${unit.unit_number}` : 'معاينة الوحدة'}
      description={unit ? `${propertyTitle ?? 'العقار غير محدد'}` : undefined}
      status={status ? <StatusBadge tone={unitStatusTones[status]}>{unitStatusLabels[status]}</StatusBadge> : undefined}
      footer={unit ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({
              to: '/properties/$propertyId/units/$unitId',
              params: { propertyId: unit.property_id, unitId: unit.id },
            })}
          >
            <FolderOpen className="me-2 size-4" aria-hidden="true" />
            فتح ملف الوحدة
          </Button>
          {onEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => onEdit(unit)}>
              <Pencil className="me-2 size-4" aria-hidden="true" />
              تعديل البيانات
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {unit ? (
        <PreviewFacts
          rows={[
            { label: 'العقار', value: propertyTitle ?? 'غير محدد' },
            { label: 'الدور', value: unit.floor ?? '—' },
            { label: 'الإيجار المرجعي', value: <span dir="ltr">{companyFormatters.money(unit.rent_amount ?? 0)}</span> },
            ...(unit.daily_reference_rate != null
              ? [{ label: 'سعر اليوم المرجعي', value: <span dir="ltr">{companyFormatters.money(unit.daily_reference_rate)}</span> }]
              : []),
            { label: 'ملاحظات', value: unit.notes ?? '—', wide: true },
          ]}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}
