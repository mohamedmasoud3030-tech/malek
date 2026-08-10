import { useNavigate, useParams } from '@tanstack/react-router';
import { OwnersWorkspace } from '@/features/owners/OwnersPage';
import { OwnerFormDialog } from '@/features/owners/components/owner-form-dialog';
import { useOwner } from '@/features/owners/useOwners';
import { useBackgroundLocation } from '@/app/router/background-location';

/**
 * /owners/$ownerId/edit — quick-edit journey.
 *
 * Route-native dialog: internal navigation from the owner dossier shows the
 * same OwnerFormDialog used by the owners workspace over the workspace
 * register; direct/refresh shows the same dialog over the register with a
 * fallback to /owners.
 */
export function OwnerEditRouteComponent() {
  const { ownerId } = useParams({ strict: false }) as { ownerId?: string };
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const isDialog = background !== null && background.pathname === '/owners';
  const ownerQuery = useOwner(ownerId ?? '');
  const closeToDirectory = () => {
    if (isDialog) window.history.back();
    else void navigate({ to: '/owners' });
  };

  if (!ownerId) {
    return <OwnersWorkspace />;
  }

  return (
    <>
      <OwnersWorkspace />
      <OwnerFormDialog
        owner={ownerQuery.data ?? null}
        open
        onOpenChange={(open) => {
          if (!open) closeToDirectory();
        }}
      />
    </>
  );
}
