import { useNavigate, useParams } from '@tanstack/react-router';
import { ContractPreviewDialog } from '@/features/contracts/components/ContractPreviewDialog';
import { ContractDetailPage } from '@/features/contracts/pages/ContractDetailPage';
import { useBackgroundLocation } from '@/app/router/background-location';
import { RelationshipsHubPage } from '@/features/relationships-hub/relationships-hub-workspace';

export function ContractDetailRouteComponent() {
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const contractId = params.contractId ?? '';
  const navigate = useNavigate();
  const background = useBackgroundLocation();
  // Internal navigation from contracts list → dialog over background; direct → full page
  const isDialog =
    background !== null &&
    (background.pathname === '/contracts' || background.pathname.startsWith('/contracts'));

  if (!contractId) return null;

  if (isDialog) {
    return (
      <>
        <RelationshipsHubPage />
        <ContractPreviewDialog
          contractId={contractId}
          open
          onOpenChange={(open) => {
            if (!open) void navigate({ to: '/contracts' });
          }}
        />
      </>
    );
  }

  return <ContractDetailPage />;
}
