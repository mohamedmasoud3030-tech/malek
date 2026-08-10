import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Edit } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { fetchOwnerActivity } from '@/services/owner-workspace-service';
import { listOwnerSettlements } from '../services/owner-settlements-service';
import { useOwnerDetailSnapshot } from '../useOwners';
import { OwnerDossierBody } from './owner-dossier-body';

export function OwnerPreviewDialog({
  ownerId,
  open,
  onOpenChange,
}: Readonly<{
  ownerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const { authorization } = useAuth();
  const canViewSettlements = canAccess(authorization, 'financial.owner_settlements.view');
  const detailQuery = useOwnerDetailSnapshot(ownerId ?? '');
  const settlementsQuery = useQuery({
    queryKey: ['owner-settlements', 'preview', ownerId],
    queryFn: listOwnerSettlements,
    enabled: Boolean(ownerId) && canViewSettlements,
  });
  const activityQuery = useQuery({
    queryKey: ['owner-activity', 'preview', ownerId],
    queryFn: () => fetchOwnerActivity(ownerId ?? ''),
    enabled: Boolean(ownerId),
  });
  const snapshot = detailQuery.data;
  const owner = snapshot?.owner;

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="ملف المالك"
      description="بيانات المالك والعقارات والوحدات والعقود والسياق المالي والتسويات والمستندات من المكوّن الموحد."
      actions={owner ? (
        <Button asChild className="min-h-11">
          <Link to="/owners/$ownerId/edit" params={{ ownerId: owner.id }}>
            <Edit className="me-2 size-4" />تعديل
          </Link>
        </Button>
      ) : undefined}
    >
      {detailQuery.isLoading ? <LoadingState label="جارٍ تحميل ملف المالك" /> : null}
      {detailQuery.isError ? (
        <ErrorState
          title="تعذر تحميل ملف المالك"
          description={detailQuery.error instanceof Error ? detailQuery.error.message : 'حدث خطأ أثناء تحميل بيانات المالك.'}
          onRetry={() => { void detailQuery.refetch(); }}
        />
      ) : null}
      {snapshot && owner ? (
        <OwnerDossierBody
          snapshot={snapshot}
          settlements={canViewSettlements && settlementsQuery.data
            ? settlementsQuery.data.filter((item) => item.owner_id === owner.id).slice(0, 5)
            : undefined}
          canOpenOwnerSettlements={canViewSettlements}
          activity={activityQuery.data}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}
