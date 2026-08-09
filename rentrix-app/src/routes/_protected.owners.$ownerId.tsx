import { useNavigate, useParams } from '@tanstack/react-router';
import { OwnerPreviewDialog } from '@/features/owners/components/OwnerPreviewDialog';
import { OwnerDetailPage } from '@/features/owners/owner-detail-page';
import { useBackgroundLocation } from '@/app/router/background-location';
import { OwnersWorkspace } from '@/features/owners/OwnersPage';

export function OwnerDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const ownerId = params.ownerId ?? '';
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const isDialog =
    background !== null &&
    (background.pathname === '/owners' || background.pathname.startsWith('/owners'));

  if (!ownerId) return null;

  if (isDialog) {
    return (
      <>
        <OwnersWorkspace />
        <OwnerPreviewDialog
          ownerId={ownerId}
          open
          onOpenChange={(open) => {
            if (!open) void navigate({ to: '/owners' });
          }}
        />
      </>
    );
  }

  return <OwnerDetailPage />;
}
