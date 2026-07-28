import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { AutomationCenterView } from './automation-center-view';

export type AutomationWorkspaceMode = 'standalone' | 'embedded';

export type AutomationWorkspaceProps = Readonly<{
  /**
   * standalone: renders the full page shell (PageLayout + PageHeader) —
   * used by the legacy /automation route when visited directly.
   * embedded: renders only the workspace body — used inside the operations
   * hub, which already supplies its own page shell and section header.
   */
  mode?: AutomationWorkspaceMode;
}>;

/**
 * Wraps AutomationCenterView (rules, run log, notifications, templates) with
 * the standalone page shell or leaves it bare for embedding inside the
 * operations hub. AutomationCenterView itself is unchanged and unduplicated.
 */
export function AutomationWorkspace({ mode = 'standalone' }: AutomationWorkspaceProps) {
  if (mode === 'embedded') {
    return <AutomationCenterView />;
  }

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="مركز الأتمتة"
        description="إدارة تذكيرات انتهاء العقود، استحقاق الإيجار، تقارير الملاك، وتنبيهات الصيانة من مكان واحد."
      />
      <AutomationCenterView />
    </PageLayout>
  );
}
