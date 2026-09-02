import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Building2, Edit, FileChartColumn, FileText, Landmark, UserRoundCog } from 'lucide-react';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { Button } from '@/components/ui/button';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useDialogNavigate } from '@/app/router/background-location';
import type { OwnerActivityRecord } from '@/services/owner-workspace-service';
import type { OwnerDetailState } from '../types';
import { getOwnerDisplayName } from '../services/owner-service';
import { OwnerDossierBody, type OwnerDossierSection } from './owner-dossier-body';
import { OwnerFinancialAuthoritySection } from './owner-financial-authority-section';
import { OwnerPortalLinkAction } from './OwnerPortalLinkAction';

type OwnerDetailSection = OwnerDossierSection | 'financials';

export function OwnerDetailView({
  state,
  activity,
  refreshError,
  onRetry,
  isRefreshing = false,
}: Readonly<{
  state: OwnerDetailState;
  activity?: readonly OwnerActivityRecord[];
  refreshError?: unknown;
  onRetry?: () => void;
  isRefreshing?: boolean;
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
        errorAction={<Button type="button" loading={isRefreshing} onClick={onRetry ?? (() => globalThis.location.reload())}>إعادة المحاولة</Button>}
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

  return (
    <OwnerDetailReady
      state={state}
      activity={activity}
      refreshError={refreshError}
      onRetry={onRetry}
      isRefreshing={isRefreshing}
    />
  );
}

/** Ready-only child keeps its hook lifecycle stable across query state changes. */
function OwnerDetailReady({
  state,
  activity,
  refreshError,
  onRetry,
  isRefreshing,
}: Readonly<{
  state: Extract<OwnerDetailState, { status: 'ready' }>;
  activity?: readonly OwnerActivityRecord[];
  refreshError?: unknown;
  onRetry?: () => void;
  isRefreshing: boolean;
}>) {
  const { authorization } = useAuth();
  const dialogNavigate = useDialogNavigate();
  const [activeSection, setActiveSection] = useState<OwnerDetailSection>('overview');
  const { owner } = state.snapshot;
  // Owner writes are governed by the canonical owners write gate (owners.hub.view):
  // effective grant (or ADMIN/MANAGER role) determines edit availability.
  const canEditOwner = canAccess(authorization, 'owners.hub.view');
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);
  const canOpenOwnerSettlements = canAccess(authorization, 'financial.owner_settlements.view');
  // The financial authority tab surfaces server-authoritative settlement
  // figures; it is only offered to users permitted to read owner settlements
  // or financial reports (the RPCs themselves also fail closed).
  const canViewFinancialAuthority = canOpenOwnerSettlements || canViewReports;
  const sections = [
    { id: 'overview', label: 'نظرة عامة', icon: UserRoundCog },
    { id: 'portfolio', label: 'العقارات والعقود', icon: Building2 },
    ...(canViewFinancialAuthority ? ([{ id: 'financials', label: 'الموقف المالي', icon: Landmark }] as const) : []),
    { id: 'records', label: 'السجل والمستندات', icon: FileText },
  ] as const;

  // Owner portal export is a secondary header action; the component renders
  // nothing unless the user holds the owner.portal.link permission.
  const canExportOwnerPortalLink = canAccess(authorization, 'owner.portal.link');

  const actions = canEditOwner || canViewReports || canExportOwnerPortalLink ? (
    <div className="flex flex-wrap gap-2">
      <OwnerPortalLinkAction ownerId={owner.id} />
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
    <PageLayout dir="rtl" size="wide">
      {refreshError ? <DataRefreshAlert onRetry={onRetry} isRefreshing={isRefreshing} /> : null}
      <EntityDetailHeader
        title="ملف المالك"
        subtitle="بيانات المالك واتفاقيات الإدارة والعقارات المرتبطة والمستندات الأساسية. المالية التفصيلية في مساحة المال والتقارير."
        backTo="/owners"
        backLabel="الملاك"
        actions={actions}
      />
      <SectionTabs
        items={sections}
        activeId={activeSection}
        onChange={setActiveSection}
        ariaLabel="أقسام ملف المالك"
        compactMobile
      />
      <SectionTabPanel id="overview" activeId={activeSection}>
      <OwnerDossierBody snapshot={state.snapshot} activity={activity} section="overview" />
      </SectionTabPanel>
      <SectionTabPanel id="portfolio" activeId={activeSection}>
      <OwnerDossierBody snapshot={state.snapshot} section="portfolio" />
      </SectionTabPanel>
      {canViewFinancialAuthority ? (
        <SectionTabPanel id="financials" activeId={activeSection}>
          {/* Mount only after the user opens the tab so the authority RPCs run on demand. */}
          {activeSection === 'financials' ? (
            <OwnerFinancialAuthoritySection
              ownerId={owner.id}
              ownerName={getOwnerDisplayName(owner)}
              canOpenOwnerSettlements={canOpenOwnerSettlements}
            />
          ) : null}
        </SectionTabPanel>
      ) : null}
      <SectionTabPanel id="records" activeId={activeSection}>
      <OwnerDossierBody snapshot={state.snapshot} activity={activity} section="records" />
      </SectionTabPanel>
    </PageLayout>
  );
}
