import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { DepositsWorkspace as DepositsWorkspaceBody } from './deposits-workspace';

export type DepositsWorkspaceMode = 'standalone' | 'embedded';

export type DepositsPageProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) — used
   * by the legacy /deposits route when visited directly.
   * embedded: renders only the workspace body — used inside the
   * deposits/settlements finance hub, which already supplies its own page
   * shell and tab header.
   */
  mode?: DepositsWorkspaceMode;
}>;

/**
 * Owns the deposits workspace body. Shared verbatim between the standalone
 * /deposits route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function DepositsPage({ mode = 'standalone' }: DepositsPageProps) {
  if (mode === 'embedded') {
    return <DepositsWorkspaceBody />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide">
      <PageHeader
        title="تأمين وأمانات المستأجرين"
        description="تسجيل مبالغ التأمين المحتجزة للعقود النشطة، ومتابعة الخصومات والاستردادات مع مستندات الطباعة."
      />
      <DepositsWorkspaceBody />
    </PageLayout>
  );
}

export default DepositsPage;
