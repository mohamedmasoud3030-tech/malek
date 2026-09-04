import { useParams } from '@tanstack/react-router';
import { LandDetailPage } from '@/features/lands/components/LandDossier';

export function LandDetailRouteComponent() {
  const { landId = '' } = useParams({ strict: false }) as { landId?: string };
  if (!landId) return null;
  return <LandDetailPage landId={landId} />;
}
