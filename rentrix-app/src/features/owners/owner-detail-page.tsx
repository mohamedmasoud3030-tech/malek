import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { OwnerDetailView } from './components/owner-detail-view';
import { fetchOwnerActivity } from '@/services/owner-workspace-service';
import { useOwnerDetailSnapshot } from './useOwners';

export function OwnerDetailPage() {
  const params = useParams({ strict: false });
  const ownerId = typeof params.ownerId === 'string' ? params.ownerId : '';
  const ownerDetailQuery = useOwnerDetailSnapshot(ownerId);
  const activityQuery = useQuery({
    queryKey: ['owner-activity', ownerId],
    queryFn: () => fetchOwnerActivity(ownerId),
    enabled: Boolean(ownerId),
  });

  if (!ownerId) return <OwnerDetailView state={{ status: 'unavailable', reason: 'معرف المالك غير موجود في الرابط.' }} />;
  if (ownerDetailQuery.isPending) return <OwnerDetailView state={{ status: 'loading' }} />;
  if (ownerDetailQuery.isError) return <OwnerDetailView state={{ status: 'error', error: ownerDetailQuery.error }} />;

  return (
    <OwnerDetailView
      state={{ status: 'ready', snapshot: ownerDetailQuery.data }}
      activity={activityQuery.data}
    />
  );
}
