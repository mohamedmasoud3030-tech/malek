import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { OwnerDetailView } from './components/owner-detail-view';
import { listOwnerSettlements } from './services/owner-settlements-service';
import { useOwnerDetailSnapshot } from './useOwners';

export function OwnerDetailPage() {
  const { ownerId } = useParams({ from: '/protected/owners/$ownerId' });
  const ownerDetailQuery = useOwnerDetailSnapshot(ownerId);
  const { authorization } = useAuth();
  const canViewSettlements = canAccess(authorization, 'financial.owner_settlements.view');
  const settlementsQuery = useQuery({
    queryKey: ['owner-settlements', 'by-owner', ownerId],
    queryFn: listOwnerSettlements,
    enabled: Boolean(ownerId) && canViewSettlements,
  });

  if (!ownerId) return <OwnerDetailView state={{ status: 'unavailable', reason: 'معرف المالك غير موجود في الرابط.' }} />;
  if (ownerDetailQuery.isPending) return <OwnerDetailView state={{ status: 'loading' }} />;
  if (ownerDetailQuery.isError) return <OwnerDetailView state={{ status: 'error', error: ownerDetailQuery.error }} />;

  const ownerSettlements = canViewSettlements && settlementsQuery.data
    ? [...settlementsQuery.data]
        .filter((settlement) => settlement.owner_id === ownerId)
        .sort((a, b) => b.period_end.localeCompare(a.period_end))
    : undefined;

  return (
    <OwnerDetailView
      state={{ status: 'ready', snapshot: ownerDetailQuery.data }}
      settlements={ownerSettlements}
      canOpenOwnerSettlements={canViewSettlements}
    />
  );
}
