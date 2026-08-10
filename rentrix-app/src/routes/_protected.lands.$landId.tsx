import { useParams } from '@tanstack/react-router';
import { useBackgroundLocation } from '@/app/router/background-location';
import { LandsWorkspace } from '@/features/lands/lands-page';
import { LandDetailPage, LandPreviewDialog } from '@/features/lands/components/LandDossier';

export function LandDetailRouteComponent() {
  const { landId = '' } = useParams({ strict: false }) as { landId?: string };
  const isDialog = useBackgroundLocation() !== null;
  if (!landId) return null;
  if (!isDialog) return <LandDetailPage landId={landId} />;
  return <><LandsWorkspace embedded /><LandPreviewDialog landId={landId} open onOpenChange={(open) => { if (!open) window.history.back(); }} /></>;
}
