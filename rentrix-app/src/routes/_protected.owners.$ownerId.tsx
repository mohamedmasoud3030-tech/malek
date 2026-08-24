import { useParams } from '@tanstack/react-router';
import { OwnerDetailPage } from '@/features/owners/owner-detail-page';

/** Owner dossiers are full workspaces; do not mask them inside a route dialog. */
export function OwnerDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const ownerId = params.ownerId ?? '';

  if (!ownerId) return null;

  return <OwnerDetailPage />;
}
