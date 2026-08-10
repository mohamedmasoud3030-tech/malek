import { useNavigate, useParams } from '@tanstack/react-router';
import { UnitPreviewDialog } from '@/features/units/components/UnitPreviewDialog';
import { PropertyUnitDetailPage } from '@/features/properties/units/property-unit-detail-page';
import { useBackgroundLocation } from '@/app/router/background-location';
import { PropertyDetailPage } from '@/features/properties/property-detail-page';

export function PropertyUnitDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const unitId = params.unitId ?? '';
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const isDialog = background !== null;

  if (!unitId) return null;

  if (isDialog) {
    return (
      <>
        <PropertyDetailPage />
        <UnitPreviewDialog
          unitId={unitId}
          open
          onOpenChange={(open) => {
            if (!open) {
              if (isDialog) window.history.back();
              else void navigate({ to: '/properties/$propertyId/units', params: { propertyId: params.propertyId ?? '' } });
            }
          }}
        />
      </>
    );
  }

  return <PropertyUnitDetailPage />;
}
