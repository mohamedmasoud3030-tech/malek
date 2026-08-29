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

  const retry = () => { void Promise.all([ownerDetailQuery.refetch(), activityQuery.refetch()]); };
  const isRefreshing = ownerDetailQuery.isFetching || activityQuery.isFetching;

  if (!ownerId) return <OwnerDetailView state={{ status: 'unavailable', reason: 'معرف المالك غير موجود في الرابط.' }} />;
  if (ownerDetailQuery.data) {
    return (
      <OwnerDetailView
        state={{ status: 'ready', snapshot: ownerDetailQuery.data }}
        activity={activityQuery.data}
        refreshError={ownerDetailQuery.isError ? ownerDetailQuery.error : activityQuery.isError ? activityQuery.error : undefined}
        onRetry={retry}
        isRefreshing={isRefreshing}
      />
    );
  }
  if (ownerDetailQuery.isPending) return <OwnerDetailView state={{ status: 'loading' }} />;
  if (ownerDetailQuery.isError) {
    return <OwnerDetailView state={{ status: 'error', error: ownerDetailQuery.error }} onRetry={retry} isRefreshing={isRefreshing} />;
  }
  return <OwnerDetailView state={{ status: 'unavailable', reason: 'لم يرجع مصدر البيانات ملفاً لهذا المالك.' }} onRetry={retry} />;
}
