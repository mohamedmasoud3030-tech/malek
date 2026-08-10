import { useNavigate, useParams } from '@tanstack/react-router';
import { OwnersWorkspace } from '@/features/owners/OwnersPage';
import { OwnerFormDialog } from '@/features/owners/components/owner-form-dialog';
import { OwnerDetailPage } from '@/features/owners/owner-detail-page';
import { useOwner } from '@/features/owners/useOwners';
import { useBackgroundLocation } from '@/app/router/background-location';

/**
 * /owners/:ownerId/edit — quick-edit journey (route-native dialog).
 *
 * Keeps the original context behind the edit dialog using the existing
 * background-location architecture:
 * - /owners → preview → edit: background stays the owners register, so the
 *   dialog renders over the register and closing returns to the preview.
 * - /owners/:ownerId (full dossier) → edit: background is the owner dossier,
 *   so the dialog renders over the dossier and closing returns to that exact
 *   dossier.
 * - Direct visit / refresh of the edit URL: deterministic fallback over the
 *   owners register; closing returns to the owner dossier.
 *
 * Owner writes are gated by the canonical owners write gate (owners.hub.view —
 * the same permission that governs owner create/edit inside the owners
 * workspace; no separate owners-write permission string exists, and backend
 * RLS remains authoritative).
 */
export function OwnerEditRouteComponent() {
  const { ownerId } = useParams({ strict: false }) as { ownerId?: string };
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  const ownerQuery = useOwner(ownerId ?? '');

  if (!ownerId) return <OwnersWorkspace />;

  const backgroundPath = background?.pathname ?? '';
  const isDialog = background !== null && (backgroundPath === '/owners' || backgroundPath.startsWith('/owners/'));
  const backgroundIsOwnerDossier = background !== null && backgroundPath.startsWith('/owners/') && backgroundPath !== '/owners';

  const closeEdit = () => {
    if (isDialog) {
      // Returns to the exact dossier or preview the user came from.
      window.history.back();
      return;
    }
    // Deterministic direct-visit fallback: land on the owner dossier.
    void navigate({ to: '/owners/$ownerId', params: { ownerId } });
  };

  return (
    <>
      {backgroundIsOwnerDossier ? <OwnerDetailPage /> : <OwnersWorkspace />}
      <OwnerFormDialog
        owner={ownerQuery.data ?? null}
        open
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      />
    </>
  );
}
