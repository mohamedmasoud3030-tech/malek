import { useNavigate, useParams } from '@tanstack/react-router';
import { PropertyPreviewDialog } from '@/features/properties/components/PropertyPreviewDialog';
import { PropertyDetailPage } from '@/features/properties/property-detail-page';
import { useBackgroundLocation } from '@/app/router/background-location';
import { PortfolioHubPage } from '@/features/portfolio-hub/portfolio-hub-workspace';

export function PropertyDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const propertyId = params.propertyId ?? '';
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const isDialog =
    background !== null &&
    (background.pathname === '/properties' || background.pathname.startsWith('/properties'));

  // Direct or refresh → full detail page (preserves URL, no redirect)
  if (!isDialog) {
    return <PropertyDetailPage />;
  }

  // Internal navigation from list → dialog over background list
  return (
    <>
      <PortfolioHubPage />
      <PropertyPreviewDialog
        propertyId={propertyId}
        open
        onOpenChange={(open) => {
          if (!open) void navigate({ to: '/properties' });
        }}
      />
    </>
  );
}
