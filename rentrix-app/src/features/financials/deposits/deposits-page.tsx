import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { DepositsWorkspace as DepositsWorkspaceBody } from './deposits-workspace';

export type DepositsWorkspaceProps = Readonly<{
  /**
   * embedded: rendered inside the finance hub, which already supplies the page
   * shell — the workspace body renders without a second layout or header.
   * standalone (default): reached via /deposits, so it owns the page shell.
   */
  embedded?: boolean;
}>;

/**
 * Owns the deposits workspace body. Shared verbatim between the standalone
 * /deposits route and the embedded finance hub tab so business logic,
 * queries, and mutations are never duplicated.
 */
export function DepositsWorkspace({ embedded = false }: DepositsWorkspaceProps) {
  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title="تأمين وأمانات المستأجرين"
      description="تسجيل مبالغ التأمين المحتجزة للعقود النشطة، ومتابعة الخصومات والاستردادات مع مستندات الطباعة."
    >
      <DepositsWorkspaceBody />
    </EmbeddableWorkspace>
  );
}

export function DepositsPage() {
  return <DepositsWorkspace />;
}

export default DepositsPage;
