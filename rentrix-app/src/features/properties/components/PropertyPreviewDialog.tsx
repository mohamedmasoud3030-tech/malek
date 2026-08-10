import { useNavigate } from '@tanstack/react-router';
import { ExternalLink, Pencil } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { useProperty } from '../use-properties';
import { PropertyDossierContent } from './property-dossier-content';

export function PropertyPreviewDialog({
  propertyId,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  propertyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (propertyId: string) => void;
}>) {
  const navigate = useNavigate();
  const propertyQuery = useProperty(propertyId ?? '');
  const property = propertyQuery.data;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={property?.title ?? 'معاينة العقار'}
      description={property?.address ?? 'تحميل تفاصيل العقار...'}
      actions={
        <>
          {property ? (
            <Button
              variant="secondary"
              className="min-h-11 bg-white/10 text-white hover:bg-white/20"
              onClick={() => navigate({ to: '/properties/$propertyId', params: { propertyId: property.id }, state: { openFull: true } as never })}
            >
              <ExternalLink className="me-2 size-4" />الملف الكامل
            </Button>
          ) : null}
          {property && onEdit ? (
            <Button className="min-h-11" onClick={() => onEdit(property.id)}>
              <Pencil className="me-2 size-4" />تعديل
            </Button>
          ) : undefined}
        </>
      }
    >
      {propertyQuery.isLoading ? <LoadingState label="جارٍ تحميل تفاصيل العقار" /> : null}
      {propertyQuery.isError ? (
        <ErrorState
          title="تعذر تحميل العقار"
          error={propertyQuery.error}
          onRetry={() => { void propertyQuery.refetch(); }}
        />
      ) : null}
      {property ? <PropertyDossierContent propertyId={property.id} /> : null}
    </EntityPreviewDialog>
  );
}
