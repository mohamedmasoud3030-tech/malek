import { Link } from '@tanstack/react-router';
import { Edit, FileChartColumn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useDialogNavigate } from '@/app/router/background-location';
import type { OwnerSettlementRecord } from '../services/owner-settlements-service';
import { getOwnerDisplayName } from '../services/owner-service';
import type { OwnerActivityRecord } from '@/services/owner-workspace-service';
import type { OwnerDetailState } from '../types';
import { OwnerDossierBody } from './owner-dossier-body';
import { OwnerFinancialAuthoritySection } from './owner-financial-authority-section';

export function OwnerDetailView({
  state,
  settlements,
  canOpenOwnerSettlements = false,
  activity,
}: Readonly<{
  state: OwnerDetailState;
  settlements?: readonly OwnerSettlementRecord[];
  canOpenOwnerSettlements?: boolean;
  activity?: readonly OwnerActivityRecord[];
}>) {
  if (state.status === 'loading') {
    return <AsyncContentState status="loading">{null}</AsyncContentState>;
  }
  if (state.status === 'error') {
    return (
      <AsyncContentState
        status="error"
        error={state.error}
        errorTitle="تعذر تحميل ملف المالك"
        errorFallbackMessage="تعذر تحميل ملف المالك."
        errorAction={<Button type="button" onClick={() => globalThis.location.reload()}>إعادة المحاولة</Button>}
      >
        {null}
      </AsyncContentState>
    );
  }
  if (state.status === 'unavailable') {
    return (
      <AsyncContentState
        status="empty"
        emptyTitle="ملف المالك غير متاح بأمان"
        emptyDescription={state.reason}
      >
        {null}
      </AsyncContentState>
    );
  }

  const { owner } = state.snapshot;
  const { authorization } = useAuth();
  const dialogNavigate = useDialogNavigate();
  // Owner writes are governed by the canonical owners write gate (owners.hub.view):
  // effective grant (or ADMIN/MANAGER role) determines edit availability.
  const canEditOwner = canAccess(authorization, 'owners.hub.view');
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);

  const actions = canEditOwner || canViewReports ? (
    <div className="flex flex-wrap gap-2">
      {canViewReports ? (
        <Button asChild variant="outline" className="min-h-11">
          <Link
            to="/reports"
            search={{ section: 'statements', ownerId: owner.id } as never}
          >
            <FileChartColumn className="me-2 size-4" aria-hidden="true" />
            كشف المالك الكامل
          </Link>
        </Button>
      ) : null}
      {canEditOwner ? (
        <Button className="min-h-11" onClick={() => dialogNavigate({ to: '/owners/$ownerId/edit', params: { ownerId: owner.id } })}>
          <Edit className="me-2 size-4" />تعديل
        </Button>
      ) : null}
    </div>
  ) : undefined;

  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <EntityDetailHeader
        title="ملف المالك"
        subtitle="ملف المالك وبياناته والعقارات والوحدات والعقود والسياق المالي والتسويات والمستندات."
        backTo="/owners"
        backLabel="الملاك"
        actions={actions}
      />
      <OwnerFinancialAuthoritySection
        ownerId={owner.id}
        ownerName={getOwnerDisplayName(owner)}
        canOpenOwnerSettlements={canOpenOwnerSettlements}
      />
      <OwnerDossierBody
        snapshot={state.snapshot}
        settlements={settlements}
        canOpenOwnerSettlements={false}
        activity={activity}
      />
    </PageLayout>
  );
}
