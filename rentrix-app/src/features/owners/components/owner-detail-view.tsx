import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Building2, Edit, FileChartColumn, FileText, UserRoundCog } from 'lucide-react';
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
import { OwnerDossierBody, type OwnerDossierSection } from './owner-dossier-body';

export function OwnerDetailView({
  state,
  activity,
}: Readonly<{
  state: OwnerDetailState;
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
  const [activeSection, setActiveSection] = useState<OwnerDossierSection>('overview');
  const sections = [
    { id: 'overview', label: 'نظرة عامة', icon: UserRoundCog },
    { id: 'portfolio', label: 'العقارات والعقود', icon: Building2 },
    { id: 'records', label: 'السجل والمستندات', icon: FileText },
  ] as const;

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
      <SectionTabPanel id="records" activeId={activeSection}>
      <OwnerDossierBody snapshot={state.snapshot} activity={activity} section="records" />
      </SectionTabPanel>
    </PageLayout>
  );
}
