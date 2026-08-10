import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { PropertyPreviewDialog } from '@/features/properties/components/PropertyPreviewDialog';
import { PropertyDetailPage } from '@/features/properties/property-detail-page';
import { useBackgroundLocation } from '@/app/router/background-location';
import { ContextualBackground } from '@/app/router/contextual-background';
import { PortfolioHubPage } from '@/features/portfolio-hub/portfolio-hub-workspace';

export function PropertyDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const propertyId = params.propertyId ?? '';
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  // "فتح الملف الكامل" from the preview explicitly requests the standalone
  // detail page even when a dialog background exists.
  const fullPageRequested = (useLocation().state as { openFull?: boolean } | null | undefined)?.openFull === true;
  const isDialog = background !== null && !fullPageRequested;

  // Direct or refresh → full detail page (preserves URL, no redirect)
  if (!isDialog) {
    return <PropertyDetailPage />;
  }

  // Internal navigation from list → dialog over background list
  return (
    <>
      <ContextualBackground location={background} fallback={<PortfolioHubPage />} />
      <PropertyPreviewDialog
        propertyId={propertyId}
        open
        onOpenChange={(open) => {
          if (!open) {
            if (isDialog) window.history.back();
            else void navigate({ to: '/properties' });
          }
        }}
      />
    </>
  );
}
