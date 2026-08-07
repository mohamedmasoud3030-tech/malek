import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { CommunicationWorkspace } from '@/features/communication/communication-page';

/**
 * Legacy standalone route compatibility for /communication.
 *
 * IA simplification 2026-08: removed the duplicate 2-tab hub that showed
 * tenants alongside communication (tenants already lives as a tab in the
 * Relationships hub at /contracts?section=tenants). Keeping a duplicate
 * tenants surface here created Sidebar → Workspace → SubNav → Tabs → Page
 * drilling and violated the "one secondary nav layer" rule.
 *
 * This route is kept for backward compatibility (bookmarks, deep links) but
 * now renders a single Communication workspace without duplicating tenants.
 * The canonical tenants surface remains at /contracts?section=tenants.
 */
export function CommunicationRouteComponent() {
  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="التواصل والمتابعات"
        description="سجل تواصل المكتب والمتابعات التشغيلية في مساحة عمل واحدة بدون تكرار تبويب المستأجرين."
      />

      <CommunicationWorkspace embedded />
    </PageLayout>
  );
}
