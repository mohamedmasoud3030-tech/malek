import { FolderOpen, Pencil } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { landCategoryLabels, landStatusLabels, landStatusTone } from '../labels';
import type { LandRecord } from '../types';

function area(value: number | null | undefined) {
  return value == null ? '—' : `${value} م²`;
}

/**
 * Land Quick Preview — glance-first.
 * Identity, plot, location, owner and value. Ownership history, commissions,
 * activity and documents live on «فتح ملف الأرض».
 */
export function LandPreviewDialog({
  land,
  ownerLabel,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  land: LandRecord | null;
  ownerLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (land: LandRecord) => void;
}>) {
  const navigate = useNavigate();
  const companyFormatters = useCompanyFormatters();

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={land ? (land.name || land.plot_no || 'أرض مسجلة') : 'معاينة الأرض'}
      description={land?.location ?? undefined}
      status={land ? (
        <StatusBadge tone={landStatusTone[land.status ?? ''] ?? 'neutral'}>
          {landStatusLabels[land.status ?? ''] ?? 'حالة أخرى'}
        </StatusBadge>
      ) : undefined}
      footer={land ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({ to: '/lands/$landId', params: { landId: land.id } })}
          >
            <FolderOpen className="me-2 size-4" aria-hidden="true" />
            فتح ملف الأرض
          </Button>
          {onEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => onEdit(land)}>
              <Pencil className="me-2 size-4" aria-hidden="true" />
              تعديل
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {land ? (
        <PreviewFacts
          rows={[
            { label: 'رقم القطعة', value: land.plot_no ?? 'غير موثق' },
            { label: 'التصنيف', value: landCategoryLabels[land.category ?? ''] ?? land.category ?? '—' },
            { label: 'المساحة', value: area(land.area) },
            { label: 'المالك', value: ownerLabel },
            { label: 'سعر المالك', value: land.owner_price == null ? '—' : <span dir="ltr">{companyFormatters.money(land.owner_price)}</span> },
            { label: 'سعر الشراء', value: land.purchase_price == null ? '—' : <span dir="ltr">{companyFormatters.money(land.purchase_price)}</span> },
            { label: 'ملاحظات', value: land.notes ?? '—', wide: true },
          ]}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}
